import { ICliExecutionContext } from '@qodalis/cli-core';
import { CliUsersRuntime, SIGNED_OUT_KEY } from './users-runtime';
import { promptRequiredPasswordChange } from './password-change';

/**
 * Restore the previous session. Only in passwordless development mode
 * (`requirePassword: false`, local) is the first administrator signed in
 * automatically, and never after any session ended (logout, expiry, kick).
 */
export async function restoreOrAutoLogin(context: ICliExecutionContext, runtime: CliUsersRuntime): Promise<void> {
    const { config, session, local, kv } = runtime;

    if (config.requirePasswordOnBoot) {
        // End the previous session on the backend too (it would stay valid until
        // it expires); best effort: the backend may be unreachable or the token stale
        const previous = await session.storedToken();
        if (previous) await runtime.backend.logout(previous).catch(() => undefined);
        await session.clearSession();
        return;
    }

    const restored = await session.restoreSession();
    if (restored) return;

    if (local && runtime.auth.passwordless && !(await kv.get<boolean>(SIGNED_OUT_KEY))) {
        const admin = local.firstAdmin();
        if (admin) {
            await session.start(await local.startTrustedSession(admin.id));
        }
    }
}

/** `requirePasswordOnBoot`: ask for credentials until a login succeeds. */
export async function promptBootLogin(context: ICliExecutionContext, runtime: CliUsersRuntime): Promise<void> {
    while (!runtime.session.current) {
        const entered = await context.reader.readLine('Username: ');
        if (entered === null) break; // aborted: stay signed out (protected commands ask for login)
        const username = entered.trim();
        if (!username) {
            context.writer.writeError('Username required');
            continue;
        }
        let password: string | undefined;
        if (!runtime.auth.passwordless) {
            const secret = await context.reader.readPassword('Password: ');
            if (secret === null) break;
            password = secret;
        }
        try {
            const session = await runtime.auth.login(username, password);
            if (session.user.mustChangePassword) {
                await promptRequiredPasswordChange(context, runtime.auth, session.user.id, password);
            }
        } catch (e: any) {
            context.writer.writeError(e?.message || 'Authentication failure');
        }
    }
    context.showPrompt();
}

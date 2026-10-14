import { ICliExecutionContext, ICliUser } from '@qodalis/cli-core';
import { CliUsersRuntime } from './users-runtime';

/**
 * Local mode, first boot: ask for the owner's administrator account and sign
 * it in. No account with a well-known password is created.
 */
export async function runFirstRunWizard(
    context: ICliExecutionContext,
    runtime: CliUsersRuntime,
): Promise<ICliUser | undefined> {
    const local = runtime.local;
    if (!local) return undefined;

    context.writer.writeln('');
    context.writer.writeInfo("Welcome! Let's create your user account.");
    context.writer.writeln('');

    for (;;) {
        const entered = await context.reader.readLine('Username: ');
        if (entered === null) {
            context.writer.writeWarning("Setup cancelled. Run 'login' once an administrator account exists.");
            return undefined;
        }
        const username = entered.trim();
        if (!username) {
            context.writer.writeError('Username is required.');
            continue;
        }
        const email = (await context.reader.readLine('Email: '))?.trim();
        if (!email) {
            context.writer.writeError('Email is required.');
            continue;
        }
        const password = await context.reader.readPassword('Password: ');
        if (password === null) {
            context.writer.writeWarning('Setup cancelled.');
            return undefined;
        }
        const policyError = runtime.auth.validatePassword(password);
        if (policyError) {
            context.writer.writeError(policyError);
            continue;
        }
        const confirm = await context.reader.readPassword('Confirm password: ');
        if (confirm !== password) {
            context.writer.writeError('Passwords do not match.');
            continue;
        }
        const defaultHome = `/home/${username}`;
        const homeDir = (await context.reader.readLine(`Home directory (${defaultHome}): `))?.trim() || defaultHome;

        try {
            const user = await local.createUserInternal({ name: username, email, groups: ['admin'], homeDir, password });
            await runtime.session.start(await local.startTrustedSession(user.id, 'initial setup'));
            runtime.events.emit({ type: 'user_created', user, timestamp: Date.now(), details: 'Created during initial setup' });
            return user;
        } catch (e: any) {
            context.writer.writeError(e?.message ?? 'Failed to create user.');
        }
    }
}

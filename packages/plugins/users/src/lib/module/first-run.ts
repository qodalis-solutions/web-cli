import { ICliExecutionContext, ICliUser } from '@qodalis/cli-core';
import { CliUsersRuntime } from './users-runtime';
import { EMAIL_PATTERN, NAME_PATTERN } from '../backend/validation';

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

    const cancelled = (): undefined => {
        context.writer.writeWarning("Setup cancelled. Run 'login' once an administrator account exists.");
        return undefined;
    };

    for (;;) {
        // Each answer is checked as soon as it is entered and only that one is asked again.
        const username = await askUntilValid(context, 'Username: ', (v) =>
            !v ? 'Username is required.' : NAME_PATTERN.test(v) ? null : 'Invalid user name (letters, digits, ".", "_", "@", "-"; up to 64 characters).',
        );
        if (username === null) return cancelled();
        const email = await askUntilValid(context, 'Email: ', (v) =>
            !v ? 'Email is required.' : EMAIL_PATTERN.test(v) ? null : 'Invalid email format.',
        );
        if (email === null) return cancelled();
        const fullName = await context.reader.readLine('Full name (optional): ');
        if (fullName === null) return cancelled();
        const password = await askNewPassword(context, runtime);
        if (password === null) return cancelled();
        const defaultHome = `/home/${username}`;
        const home = await context.reader.readLine(`Home directory (${defaultHome}): `);
        if (home === null) return cancelled();
        const homeDir = home.trim() || defaultHome;

        try {
            const user = await local.createUserInternal({
                name: username,
                email,
                groups: ['admin'],
                homeDir,
                password,
                ...(fullName.trim() ? { data: { fullName: fullName.trim() } } : {}),
            });
            await runtime.session.start(await local.startTrustedSession(user.id, 'initial setup'));
            runtime.events.emit({ type: 'user_created', user, timestamp: Date.now(), details: 'Created during initial setup' });
            return user;
        } catch (e: any) {
            context.writer.writeError(e?.message ?? 'Failed to create user.');
        }
    }
}

async function askUntilValid(
    context: ICliExecutionContext,
    prompt: string,
    check: (value: string) => string | null,
): Promise<string | null> {
    for (;;) {
        const entered = await context.reader.readLine(prompt);
        if (entered === null) return null;
        const error = check(entered.trim());
        if (!error) return entered.trim();
        context.writer.writeError(error);
    }
}

async function askNewPassword(context: ICliExecutionContext, runtime: CliUsersRuntime): Promise<string | null> {
    for (;;) {
        const password = await context.reader.readPassword('Password: ');
        if (password === null) return null;
        const policyError = runtime.auth.validatePassword(password);
        if (policyError) {
            context.writer.writeError(policyError);
            continue;
        }
        const confirm = await context.reader.readPassword('Confirm password: ');
        if (confirm === null) return null;
        if (confirm === password) return password;
        context.writer.writeError('Passwords do not match.');
    }
}

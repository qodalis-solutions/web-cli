import { ICliCommandGuard, ICliExecutionContext } from '@qodalis/cli-core';

/** Commands available while a password change is pending */
const ALLOWED = new Set(['passwd', 'logout', 'login', 'whoami', 'help', 'clear', 'su']);

/** Blocks everything but `passwd` (and a few harmless commands) until the password is changed. */
export const passwordChangeGuard: ICliCommandGuard = {
    name: 'users:password-change-required',
    priority: -950,
    appliesTo: (processor, _command, context) =>
        !!context.userSession?.user?.mustChangePassword && !ALLOWED.has(rootCommand(processor)),
    canActivate: (_command, processor) =>
        `${processor.command}: you must change your password first (run 'passwd')`,
};

function rootCommand(processor: { command: string; parent?: unknown }): string {
    let current: any = processor;
    while (current?.parent) current = current.parent;
    return current?.command ?? processor.command;
}

/**
 * After a sign-in that requires a new password, ask for it right away.
 * `currentPassword` is what the user just typed (undefined for passwordless).
 */
export async function promptRequiredPasswordChange(
    context: ICliExecutionContext,
    auth: {
        setPassword(userId: string, password: string, currentPassword?: string): Promise<void>;
        validatePassword?(password: string): string | null;
    },
    userId: string,
    currentPassword: string | undefined,
): Promise<boolean> {
    context.writer.writeWarning('Your password must be changed before you continue.');
    for (let attempt = 0; attempt < 3; attempt++) {
        const password = await context.reader.readPassword('New password: ');
        if (password === null) return false;
        const policyError = auth.validatePassword?.(password);
        if (policyError) {
            context.writer.writeError(policyError);
            continue;
        }
        const confirm = await context.reader.readPassword('Retype new password: ');
        if (confirm !== password) {
            context.writer.writeError('Passwords do not match.');
            continue;
        }
        await auth.setPassword(userId, password, currentPassword);
        context.writer.writeSuccess('Password changed.');
        return true;
    }
    return false;
}

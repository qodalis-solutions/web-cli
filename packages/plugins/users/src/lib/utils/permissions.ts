import { ICliExecutionContext } from '@qodalis/cli-core';

/**
 * Checks if the current user is in the admin group.
 * Writes an error and returns false if not.
 */
export function requireAdmin(context: ICliExecutionContext): boolean {
    const session = context.userSession;
    if (!session || !session.user.groups.includes('admin')) {
        context.writer.writeError('permission denied');
        return false;
    }
    return true;
}

/**
 * Checks if the current user is the given user or is an admin.
 */
export function requireSelfOrAdmin(
    context: ICliExecutionContext,
    targetUserId: string,
): boolean {
    const session = context.userSession;
    if (!session) {
        context.writer.writeError('permission denied');
        return false;
    }
    if (
        session.user.id === targetUserId ||
        session.user.groups.includes('admin')
    ) {
        return true;
    }
    context.writer.writeError('permission denied');
    return false;
}

import { ICliCommandGuard, ICliCommandProcessor } from '@qodalis/cli-core';

function requiredGroups(processor: ICliCommandProcessor): string[] {
    const groups = processor.metadata?.requiredGroups;
    return Array.isArray(groups) ? groups : [];
}

function requiresAuth(processor: ICliCommandProcessor): boolean {
    return processor.metadata?.requireAuth === true || requiredGroups(processor).length > 0;
}

/**
 * Blocks commands whose processor declares `metadata.requireAuth`
 * (or `metadata.requiredGroups`) when nobody is signed in.
 * Applies to commands from any module, not only the users module.
 */
export const requireAuthGuard: ICliCommandGuard = {
    name: 'users:require-auth',
    priority: -100,
    appliesTo: (processor) => requiresAuth(processor),
    canActivate: (_command, processor, context) =>
        context.userSession?.user ? true : `${processor.command}: login required`,
};

/**
 * Blocks commands whose processor declares `metadata.requiredGroups` when the
 * signed-in user is in none of those groups.
 * Applies to commands from any module, not only the users module.
 */
export const requiredGroupsGuard: ICliCommandGuard = {
    name: 'users:required-groups',
    priority: -90,
    appliesTo: (processor) => requiredGroups(processor).length > 0,
    canActivate: (_command, processor, context) => {
        const user = context.userSession?.user;
        if (!user) {
            return `${processor.command}: login required`;
        }
        const required = requiredGroups(processor);
        const userGroups = user.groups ?? [];
        return required.some((g) => userGroups.includes(g))
            ? true
            : `${processor.command}: permission denied (requires group: ${required.join(' or ')})`;
    },
};

/** Guards contributed by the users module */
export const usersGuards: ICliCommandGuard[] = [requireAuthGuard, requiredGroupsGuard];

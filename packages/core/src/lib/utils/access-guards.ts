import { ICliCommandGuard } from '../interfaces/command-guards';
import { ICliCommandProcessor } from '../interfaces/command-processor';
import {
    ICliAuthorizationService,
    ICliAuthorizationService_TOKEN,
} from '../interfaces/authorization';
import { ICliExecutionContext } from '../interfaces/execution-context';
import { cliMissingPermissions } from './permissions';

const list = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()) : [];

const authorization = (context: ICliExecutionContext): ICliAuthorizationService | undefined => {
    try {
        return context.services.get<ICliAuthorizationService>(ICliAuthorizationService_TOKEN);
    } catch {
        return undefined;
    }
};

/**
 * The processor and its ancestors (sub-commands inherit the access rules of
 * their parents: `pkg add` is protected by metadata on `pkg`).
 */
function chain(processor: ICliCommandProcessor): ICliCommandProcessor[] {
    const out: ICliCommandProcessor[] = [];
    let current: ICliCommandProcessor | undefined = processor;
    while (current && out.length < 32 && !out.includes(current)) {
        out.push(current);
        current = (current as { parent?: ICliCommandProcessor }).parent;
    }
    return out;
}

/** All required permissions along the chain (each level's requirements apply). */
const requiredPermissionsOf = (p: ICliCommandProcessor): string[] =>
    [...new Set(chain(p).flatMap((x) => list(x.metadata?.requiredPermissions)))];

/** Group requirements per level: the principal must satisfy every level. */
const requiredGroupLevels = (p: ICliCommandProcessor): string[][] =>
    chain(p).map((x) => list(x.metadata?.requiredGroups)).filter((g) => g.length > 0);

const needsAuth = (p: ICliCommandProcessor): boolean =>
    chain(p).some((x) => x.metadata?.requireAuth === true) ||
    requiredGroupLevels(p).length > 0 ||
    requiredPermissionsOf(p).length > 0;

/**
 * `metadata.requireAuth` (also implied by `requiredGroups` /
 * `requiredPermissions`): the command needs a signed-in principal.
 * Active only when an {@link ICliAuthorizationService} is registered.
 */
export const cliRequireAuthGuard: ICliCommandGuard = {
    name: 'access:require-auth',
    priority: -100,
    appliesTo: (processor, _command, context) => needsAuth(processor) && !!authorization(context),
    canActivate: (_command, processor, context) =>
        authorization(context)!.getPrincipal() ? true : `${processor.command}: login required`,
};

/**
 * `metadata.requiredGroups`: the principal must belong to at least one group.
 * Active only when an {@link ICliAuthorizationService} is registered.
 */
export const cliRequiredGroupsGuard: ICliCommandGuard = {
    name: 'access:required-groups',
    priority: -90,
    appliesTo: (processor, _command, context) =>
        requiredGroupLevels(processor).length > 0 && !!authorization(context),
    canActivate: (_command, processor, context) => {
        const auth = authorization(context)!;
        const principal = auth.getPrincipal();
        if (!principal) return `${processor.command}: login required`;
        if (auth.can('*')) return true;
        for (const required of requiredGroupLevels(processor)) {
            const member = required.some((g) => principal.groups.some((pg) => pg.toLowerCase() === g.toLowerCase()));
            if (!member) return `${processor.command}: permission denied (requires group: ${required.join(' or ')})`;
        }
        return true;
    },
};

/**
 * `metadata.requiredPermissions`: the principal must hold all permissions.
 * Active only when an {@link ICliAuthorizationService} is registered.
 */
export const cliRequiredPermissionsGuard: ICliCommandGuard = {
    name: 'access:required-permissions',
    priority: -80,
    appliesTo: (processor, _command, context) =>
        requiredPermissionsOf(processor).length > 0 && !!authorization(context),
    canActivate: (_command, processor, context) => {
        const principal = authorization(context)!.getPrincipal();
        if (!principal) return `${processor.command}: login required`;
        const missing = cliMissingPermissions(principal.permissions, requiredPermissionsOf(processor));
        return missing.length === 0
            ? true
            : `${processor.command}: permission denied (requires ${missing.join(', ')})`;
    },
};

/**
 * Guards enforcing access metadata on processors. Registered by the CLI
 * engine; they do nothing until an auth module registers an
 * {@link ICliAuthorizationService}.
 */
export const cliAccessMetadataGuards: ICliCommandGuard[] = [
    cliRequireAuthGuard,
    cliRequiredGroupsGuard,
    cliRequiredPermissionsGuard,
];

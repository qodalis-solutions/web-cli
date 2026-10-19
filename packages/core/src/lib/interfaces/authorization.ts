import { ICliOwnership } from '../models/permissions';
import { ICliExecutionContext } from './execution-context';
import {
    ICliAuthorizationService_TOKEN,
    ICliPermissionRegistry_TOKEN,
} from '../tokens';
import { cliHasPermission } from '../utils/permissions';

export { ICliAuthorizationService_TOKEN, ICliPermissionRegistry_TOKEN };

/**
 * A permission an extension uses, declared so tools (`perms --list`,
 * `groupmod --grant` completion, docs) can show it. Declaring is optional:
 * any `resource:action` string can be granted and checked.
 */
export interface CliPermissionDefinition {
    /** Permission string, `resource:action` (e.g. `files:chown`). */
    name: string;
    /** Human readable description. */
    description?: string;
    /** Module that declared it (filled in at registration). */
    module?: string;
}

/** Registry of permissions declared by modules (`ICliModule.permissions`). */
export interface ICliPermissionRegistry {
    register(definitions: CliPermissionDefinition[], module?: string): void;
    list(): CliPermissionDefinition[];
    get(name: string): CliPermissionDefinition | undefined;
    /** Remove the permissions registered by `module` (when it is unloaded). */
    unregister?(module: string): void;
}

/** The identity checks are made against. */
export interface ICliPrincipal {
    /** User id */
    id: string;
    /** Login name (used as file owner) */
    name: string;
    /** Group (role) names */
    groups: string[];
    /** Effective permissions (union of the groups' permissions) */
    permissions: string[];
}

/** rwx-style protected resource (files, directories, or anything an extension owns). */
export interface ICliProtectedResource {
    ownership?: ICliOwnership;
    /** 9-char mode string, e.g. `rwxr-x---` */
    permissions?: string;
}

export type CliAccessAction = 'read' | 'write' | 'execute';

/**
 * Authorization service. Provided by an auth module (the users module provides
 * one in local and in server mode). Extensions should use the helpers
 * {@link cliAuthorize} / {@link cliCanAccess}, which allow everything when no
 * authorization service is registered.
 */
export interface ICliAuthorizationService {
    /** The signed-in principal, or undefined when nobody is signed in. */
    getPrincipal(): ICliPrincipal | undefined;

    /** Does the current principal hold `permission` (wildcards honoured)? */
    can(permission: string): boolean;

    /**
     * rwx check on a resource for the current principal (owner / group / other).
     * Principals holding `*` or any of `bypassPermissions` are always allowed.
     * Resources without a mode or ownership are allowed.
     */
    canAccess(
        resource: ICliProtectedResource,
        action: CliAccessAction,
        bypassPermissions?: string[],
    ): boolean;
}

/** Thrown when an operation is not permitted. The message is user facing. */
export class CliAccessDeniedError extends Error {
    readonly code = 'EACCES';

    constructor(message = 'permission denied') {
        super(message);
        this.name = 'CliAccessDeniedError';
        Object.setPrototypeOf(this, CliAccessDeniedError.prototype);
    }
}

/** True for {@link CliAccessDeniedError} (also across bundle copies). */
export function isCliAccessDeniedError(error: unknown): error is CliAccessDeniedError {
    return (
        error instanceof CliAccessDeniedError ||
        (!!error && typeof error === 'object' && (error as any).name === 'CliAccessDeniedError')
    );
}

function authorizationService(
    context: Pick<ICliExecutionContext, 'services'>,
): ICliAuthorizationService | undefined {
    try {
        return context.services.get<ICliAuthorizationService>(ICliAuthorizationService_TOKEN);
    } catch {
        return undefined;
    }
}

/**
 * Check a permission for the current principal. Returns `true` when no
 * authorization service is registered (no auth module loaded).
 */
export function cliAuthorize(
    context: Pick<ICliExecutionContext, 'services'>,
    permission: string,
): boolean {
    const auth = authorizationService(context);
    return auth ? auth.can(permission) : true;
}

/**
 * rwx check for the current principal. Returns `true` when no authorization
 * service is registered.
 */
export function cliCanAccess(
    context: Pick<ICliExecutionContext, 'services'>,
    resource: ICliProtectedResource,
    action: CliAccessAction,
    bypassPermissions?: string[],
): boolean {
    const auth = authorizationService(context);
    return auth ? auth.canAccess(resource, action, bypassPermissions) : true;
}

/**
 * Reference rwx evaluation shared by implementations of
 * {@link ICliAuthorizationService.canAccess}.
 */
export function cliEvaluateAccess(
    principal: ICliPrincipal | undefined,
    resource: ICliProtectedResource,
    action: CliAccessAction,
    bypassPermissions: string[] = [],
): boolean {
    const mode = resource.permissions;
    const owner = resource.ownership;
    if (!mode || mode.length < 9 || !owner) return true;
    if (principal && (cliHasPermission(principal.permissions, '*') ||
        bypassPermissions.some((p) => cliHasPermission(principal.permissions, p)))) {
        return true;
    }
    let offset = 6; // other
    if (principal) {
        if (owner.uid === principal.name || owner.uid === principal.id) offset = 0;
        else if (principal.groups.some((g) => g.toLowerCase() === owner.gid.toLowerCase())) offset = 3;
    }
    const index = offset + (action === 'read' ? 0 : action === 'write' ? 1 : 2);
    return mode.charAt(index) !== '-';
}

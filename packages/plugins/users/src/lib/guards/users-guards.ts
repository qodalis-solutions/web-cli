import {
    cliAccessMetadataGuards,
    cliRequireAuthGuard,
    cliRequiredGroupsGuard,
    cliRequiredPermissionsGuard,
    ICliCommandGuard,
} from '@qodalis/cli-core';

/**
 * The access-metadata guards (`requireAuth`, `requiredGroups`,
 * `requiredPermissions`) live in `@qodalis/cli-core` and are registered by the
 * CLI engine. They become active as soon as an authorization service is
 * registered, which the users module does in both modes.
 *
 * These aliases are kept for backwards compatibility.
 */
export const requireAuthGuard: ICliCommandGuard = cliRequireAuthGuard;
export const requiredGroupsGuard: ICliCommandGuard = cliRequiredGroupsGuard;
export const requiredPermissionsGuard: ICliCommandGuard = cliRequiredPermissionsGuard;
export const usersGuards: ICliCommandGuard[] = cliAccessMetadataGuards;

/**
 * Framework-agnostic token for the CLI command processor registry.
 * Used as a key in the service provider to retrieve the registry.
 */
export const CliProcessorsRegistry_TOKEN = 'cli-processors-registry';

/**
 * Framework-agnostic token for the CLI state store manager.
 * Used as a key in the service provider to retrieve the state store manager.
 */
export const CliStateStoreManager_TOKEN = 'cli-state-store-manager';

/**
 * Framework-agnostic token for the CLI command history service.
 * Used as a key in the service provider to retrieve the command history.
 */
export const CliCommandHistory_TOKEN = 'cli-command-history';

/**
 * Framework-agnostic token for the CLI ping server service.
 * Used as a key in the service provider to retrieve the ping server service.
 */
export const ICliPingServerService_TOKEN = 'cli-ping-server-service';

/**
 * Framework-agnostic token for the CLI module registry.
 * Used as a key in the service provider to retrieve the module registry.
 */
export const CliModuleRegistry_TOKEN = 'cli-module-registry';

/**
 * Framework-agnostic token for the CLI background service registry.
 * Used as a key in the service provider to retrieve the background service registry.
 */
export const CliBackgroundServiceRegistry_TOKEN = 'cli-background-service-registry';

/**
 * Framework-agnostic token for the CLI package manager service.
 * Used as a key in the service provider to retrieve the package manager.
 */
export const CliPackageManagerService_TOKEN = 'cli-package-manager-service';

// Re-exported from @qodalis/cli-core for backward compatibility
export {
    ICliUserSessionService_TOKEN,
    ICliUsersStoreService_TOKEN,
} from '@qodalis/cli-core';

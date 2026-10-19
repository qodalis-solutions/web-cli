import { createCliToken } from '@qodalis/cli-core';
import type {
    CliModuleRegistry,
    ICliCommandProcessorRegistry,
    ICliKeyValueStore,
    ICliPingServerService,
} from '@qodalis/cli-core';
import type { ICliStateStoreManager } from './state/cli-state-store-manager';
import type { CliCommandHistory } from './services/cli-command-history';
import type { CliBootLog } from './services/cli-boot-log';
import type { CliBackgroundServiceRegistry } from './services/background/cli-background-service-registry';
import type { CliPackageManagerService } from './services/cli-package-manager';
import type { SyntaxHighlighterRegistry } from './editor/syntax/registry';

/**
 * Framework-agnostic token for the CLI command processor registry.
 * Used as a key in the service provider to retrieve the registry.
 */
export const CliProcessorsRegistry_TOKEN = createCliToken<ICliCommandProcessorRegistry>('cli-processors-registry');

/**
 * Framework-agnostic token for the CLI state store manager.
 * Used as a key in the service provider to retrieve the state store manager.
 */
export const CliStateStoreManager_TOKEN = createCliToken<ICliStateStoreManager>('cli-state-store-manager');

/**
 * Framework-agnostic token for the CLI command history service.
 * Used as a key in the service provider to retrieve the command history.
 */
export const CliCommandHistory_TOKEN = createCliToken<CliCommandHistory>('cli-command-history');

/**
 * Framework-agnostic token for the CLI ping server service.
 * Used as a key in the service provider to retrieve the ping server service.
 */
export const ICliPingServerService_TOKEN = createCliToken<ICliPingServerService>('cli-ping-server-service');

/**
 * Framework-agnostic token for the CLI module registry.
 * Used as a key in the service provider to retrieve the module registry.
 */
export const CliModuleRegistry_TOKEN = createCliToken<CliModuleRegistry>('cli-module-registry');

/**
 * The live boot report (`CliBootLog`) while the CLI starts. Processors and
 * modules can add steps and lines from `initialize`/`onInit`; it ignores
 * entries once boot has finished.
 */
export const CliBootLog_TOKEN = createCliToken<CliBootLog>('cli-boot-log');

/**
 * Framework-agnostic token for the CLI background service registry.
 * Used as a key in the service provider to retrieve the background service registry.
 */
export const CliBackgroundServiceRegistry_TOKEN = createCliToken<CliBackgroundServiceRegistry>('cli-background-service-registry');

/**
 * Framework-agnostic token for the CLI package manager service.
 * Used as a key in the service provider to retrieve the package manager.
 */
export const CliPackageManagerService_TOKEN = createCliToken<CliPackageManagerService>('cli-package-manager-service');

/**
 * Framework-agnostic token for the CLI key-value store.
 * Used as a key in the service provider to retrieve the persistent storage.
 */
export const CliKeyValueStore_TOKEN = createCliToken<ICliKeyValueStore>('cli-key-value-store');

/**
 * Framework-agnostic token for the syntax highlighter registry.
 * Used as a key in the service provider to retrieve the syntax highlighter registry.
 */
export const SyntaxHighlighterRegistry_TOKEN = createCliToken<SyntaxHighlighterRegistry>('syntax-highlighter-registry');

// Re-exported from @qodalis/cli-core for backward compatibility
export {
    ICliUserSessionService_TOKEN,
    ICliUsersStoreService_TOKEN,
} from '@qodalis/cli-core';

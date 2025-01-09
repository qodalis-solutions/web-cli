import { InjectionToken } from '@angular/core';
import {
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
    ICliLogger,
    ICliPingServerService,
    ICliServiceProvider,
    ICliUserSessionService,
    ICliUsersStoreService,
} from '@qodalis/cli-core';

/**
 * Represents a command processor token for dependency injection
 */
export const CliCommandProcessor_TOKEN = new InjectionToken<
    ICliCommandProcessor[]
>('cli-processors');

/**
 * Represents a user session service token for dependency injection
 */
export const ICliUserSessionService_TOKEN =
    new InjectionToken<ICliUserSessionService>('cli-user-session-service');

/**
 * Represents a user store service token for dependency injection
 */
export const ICliUsersStoreService_TOKEN = new InjectionToken<
    ICliUsersStoreService[]
>('cli-users-store-service');

/**
 * Represents a ping server service token for dependency injection
 */
export const ICliPingServerService_TOKEN = new InjectionToken<
    ICliPingServerService[]
>('cli-ping-server-service');

/**
 * Represents a logger token for dependency injection
 */
export const CliLogger_TOKEN = new InjectionToken<ICliLogger>('cli-logger');

/**
 * Represents a command processor registry token for dependency injection
 */
export const CliProcessorsRegistry_TOKEN =
    new InjectionToken<ICliCommandProcessorRegistry>('cli-processors-registry');

export const CliServiceProvider_TOKEN = new InjectionToken<ICliServiceProvider>(
    'cli-service-provider',
);

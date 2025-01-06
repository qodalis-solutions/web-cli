import { InjectionToken } from '@angular/core';
import {
    ICliCommandProcessor,
    ICliLogger,
    ICliPingServerService,
    ICliUserSessionService,
    ICliUsersStoreService,
} from '@qodalis/cli-core';

/**
 * Represents a command processor token for dependency injection
 */
export const CliCommandProcessor_TOKEN = new InjectionToken<
    ICliCommandProcessor[]
>('ICliCommandProcessor implementations');

/**
 * Represents a user session service token for dependency injection
 */
export const ICliUserSessionService_TOKEN = new InjectionToken<
    ICliUserSessionService[]
>('ICliUserSessionService implementation');

/**
 * Represents a user store service token for dependency injection
 */
export const ICliUsersStoreService_TOKEN = new InjectionToken<
    ICliUsersStoreService[]
>('ICliUsersStoreService implementation');

/**
 * Represents a ping server service token for dependency injection
 */
export const ICliPingServerService_TOKEN = new InjectionToken<
    ICliPingServerService[]
>('ICliPingServerService implementation');

/**
 * Represents a logger token for dependency injection
 */
export const CliLogger_TOKEN = new InjectionToken<ICliLogger>(
    'ICliLogger implementation',
);

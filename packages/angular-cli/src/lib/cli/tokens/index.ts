import { InjectionToken } from '@angular/core';
import {
    ICliCommandProcessor,
    ICliModule,
    ICliPingServerService,
    ICliUserSessionService,
    ICliUsersStoreService,
} from '@qodalis/cli-core';

export const CliCommandProcessor_TOKEN = new InjectionToken<
    ICliCommandProcessor[]
>('cli-processors');

export const ICliUserSessionService_TOKEN =
    new InjectionToken<ICliUserSessionService>('cli-user-session-service');

export const ICliUsersStoreService_TOKEN = new InjectionToken<
    ICliUsersStoreService[]
>('cli-users-store-service');

export const ICliPingServerService_TOKEN = new InjectionToken<
    ICliPingServerService[]
>('cli-ping-server-service');

export const CliModule_TOKEN = new InjectionToken<ICliModule[]>('cli-modules');

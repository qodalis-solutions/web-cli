import { InjectionToken } from '@angular/core';
import {
    ICliModule,
    ICliPingServerService,
    ICliUserSessionService,
    ICliUsersStoreService,
} from '@qodalis/cli-core';

export const ICliUserSessionService_TOKEN =
    new InjectionToken<ICliUserSessionService>('cli-user-session-service');

export const ICliUsersStoreService_TOKEN = new InjectionToken<
    ICliUsersStoreService[]
>('cli-users-store-service');

export const ICliPingServerService_TOKEN = new InjectionToken<
    ICliPingServerService[]
>('cli-ping-server-service');

export const CliModule_TOKEN = new InjectionToken<ICliModule[]>('cli-modules');

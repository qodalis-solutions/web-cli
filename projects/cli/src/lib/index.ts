import { Provider } from '@angular/core';
import {
    ICliPingServerService_TOKEN,
    ICliUserSessionService_TOKEN,
    ICliUsersStoreService_TOKEN,
} from './cli/tokens';
import { CliUserSessionService } from './cli/services/cli-user-session.service';
import { CliUsersStoreService } from './cli/services/cli-users-store.service';
import { resolveCommandProcessorProvider } from './utils';
import {
    CliSwitchUserCommandProcessor,
    CliHistoryCommandProcessor,
    CliLocalStorageCommandProcessor,
    CliWhoamiCommandProcessor,
    CliCookiesCommandProcessor,
    CliThemeCommandProcessor,
    CliPingCommandProcessor,
    CliPackagesCommandProcessor,
} from './cli/processors';
import {
    CliDefaultPingServerService,
    ScriptLoaderService,
} from './cli/services';

export const CliVersion = '1.0.1';

export const resolveCliProviders = (): Provider[] => {
    return [
        ScriptLoaderService,
        {
            useClass: CliUserSessionService,
            provide: ICliUserSessionService_TOKEN,
        },
        {
            useClass: CliUsersStoreService,
            provide: ICliUsersStoreService_TOKEN,
        },
        {
            useClass: CliDefaultPingServerService,
            provide: ICliPingServerService_TOKEN,
        },
        resolveCommandProcessorProvider(CliPingCommandProcessor),
        resolveCommandProcessorProvider(CliSwitchUserCommandProcessor),
        resolveCommandProcessorProvider(CliHistoryCommandProcessor),
        resolveCommandProcessorProvider(CliLocalStorageCommandProcessor),
        resolveCommandProcessorProvider(CliCookiesCommandProcessor),
        resolveCommandProcessorProvider(CliWhoamiCommandProcessor),
        resolveCommandProcessorProvider(CliThemeCommandProcessor),
        resolveCommandProcessorProvider(CliPackagesCommandProcessor),
    ];
};

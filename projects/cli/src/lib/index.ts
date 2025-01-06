import { Provider } from '@angular/core';
import {
    CliLogger_TOKEN,
    ICliPingServerService_TOKEN,
    ICliUserSessionService_TOKEN,
    ICliUsersStoreService_TOKEN,
} from './cli/tokens';
import { CliUserSessionService } from './cli/services/cli-user-session.service';
import { CliUsersStoreService } from './cli/services/cli-users-store.service';
import { resolveCommandProcessorProvider } from './utils';
import {
    CliHistoryCommandProcessor,
    CliThemeCommandProcessor,
    CliPingCommandProcessor,
    CliPackagesCommandProcessor,
    CliHotKeysCommandProcessor,
} from './cli/processors';
import {
    CliDefaultPingServerService,
    ScriptLoaderService,
} from './cli/services';
import { CliCanViewService } from './services';
import { providers as usersProviders } from './cli/processors/users';
import { CliLogger } from './services/cli-logger.service';

export const resolveCliProviders = (): Provider[] => {
    return [
        ScriptLoaderService,
        CliCanViewService,
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
        {
            useClass: CliLogger,
            provide: CliLogger_TOKEN,
        },
        ...usersProviders,
        resolveCommandProcessorProvider(CliPingCommandProcessor),
        resolveCommandProcessorProvider(CliHistoryCommandProcessor),
        resolveCommandProcessorProvider(CliThemeCommandProcessor),
        resolveCommandProcessorProvider(CliPackagesCommandProcessor),
        resolveCommandProcessorProvider(CliHotKeysCommandProcessor),
    ];
};

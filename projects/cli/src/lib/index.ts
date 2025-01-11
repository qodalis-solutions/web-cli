import { Provider } from '@angular/core';
import {
    CliLogger_TOKEN,
    CliProcessorsRegistry_TOKEN,
    CliServiceProvider_TOKEN,
    ICliPingServerService_TOKEN,
    ICliUserSessionService_TOKEN,
    ICliUsersStoreService_TOKEN,
} from './cli/tokens';
import { CliUserSessionService } from './cli/services/cli-user-session.service';
import { CliUsersStoreService } from './cli/services/cli-users-store.service';
import { resolveCommandProcessorProvider } from './utils';
import { CliPingCommandProcessor } from './cli/processors';
import {
    CliDefaultPingServerService,
    ScriptLoaderService,
} from './cli/services';
import { CliCanViewService } from './services';
import { systemProviders } from './cli/processors/system';
import { usersProviders } from './cli/processors/users';
import { CliLogger } from './services/cli-logger.service';
import { CliCommandProcessorRegistry } from './cli/services/cli-command-processor-registry';
import { CliStateStoreManager } from './cli/state/cli-state-store-manager';
import { CliServiceProvider } from './cli/services/system/cli-service-provider';
import { CliThemeCommandProcessor } from './cli/processors/theme/cli-theme-command-processor';

export const resolveCliProviders = (): Provider[] => {
    return [
        ScriptLoaderService,
        CliCanViewService,
        CliStateStoreManager,
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
        {
            useClass: CliCommandProcessorRegistry,
            provide: CliProcessorsRegistry_TOKEN,
        },
        {
            useClass: CliServiceProvider,
            provide: CliServiceProvider_TOKEN,
        },
        ...systemProviders,
        ...usersProviders,
        resolveCommandProcessorProvider(CliThemeCommandProcessor),
        resolveCommandProcessorProvider(CliPingCommandProcessor),
    ];
};

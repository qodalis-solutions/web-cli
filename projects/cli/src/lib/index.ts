import { Provider } from '@angular/core';
import {
  ICliUserSessionService_TOKEN,
  ICliUsersStoreService_TOKEN,
} from './cli/tokens';
import { CliUserSessionService } from './cli/services/cli-user-session.service';
import { CliUsersStoreService } from './cli/services/cli-users-store.service';
import { resolveCommandProcessorProvider } from './utils';
import {
  CliSwitchUserCommandProcessor,
  CliHistoryCommandProcessor,
  CliLogsCommandProcessor,
} from './cli/processors';

export const CliVersion = '1.0.1';

export const resolveCliProviders = (): Provider[] => {
  return [
    {
      useClass: CliUserSessionService,
      provide: ICliUserSessionService_TOKEN,
    },
    {
      useClass: CliUsersStoreService,
      provide: ICliUsersStoreService_TOKEN,
    },
    resolveCommandProcessorProvider(CliSwitchUserCommandProcessor),
    resolveCommandProcessorProvider(CliHistoryCommandProcessor),
    resolveCommandProcessorProvider(CliLogsCommandProcessor),
  ];
};

export * from './cli/models';

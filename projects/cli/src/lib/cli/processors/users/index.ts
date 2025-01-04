import { resolveCommandProcessorProvider } from '../../../utils';
import { CliAddUserCommandProcessor } from './cli-add-user-command-processor';
import { CliListUsersCommandProcessor } from './cli-list-users-command-processor';
import { CliSwitchUserCommandProcessor } from './cli-switch-user-command-processor';
import { CliWhoamiCommandProcessor } from './cli-whoami-command-processor';

export * from './cli-switch-user-command-processor';
export * from './cli-whoami-command-processor';
export * from './cli-add-user-command-processor';
export * from './cli-list-users-command-processor';

export const providers = [
    resolveCommandProcessorProvider(CliSwitchUserCommandProcessor),
    resolveCommandProcessorProvider(CliWhoamiCommandProcessor),
    resolveCommandProcessorProvider(CliAddUserCommandProcessor),
    resolveCommandProcessorProvider(CliListUsersCommandProcessor),
];

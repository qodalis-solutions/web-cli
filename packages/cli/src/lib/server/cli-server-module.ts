import { ICliModule, CliProvider } from '@qodalis/cli-core';
import { CliServerCommandProcessor } from './cli-server-command-processor';
import { CliSshCommandProcessor } from './cli-ssh-command-processor';

export function createServerModule(): ICliModule {
    return {
        apiVersion: 2,
        name: '@qodalis/cli-server',
        description: 'Remote server command integration',
        priority: -10,
        processors: [new CliServerCommandProcessor(), new CliSshCommandProcessor()],
        services: [] as CliProvider[],
    };
}

import { ICliModule, CliProvider } from '@qodalis/cli-core';
import { CliServerCommandProcessor } from './cli-server-command-processor';

export function createServerModule(): ICliModule {
    return {
        apiVersion: 2,
        name: '@qodalis/cli-server',
        description: 'Remote server command integration',
        priority: -10,
        processors: [new CliServerCommandProcessor()],
        services: [] as CliProvider[],
    };
}

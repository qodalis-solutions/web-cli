import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliScpCommandCommandProcessor } from './lib/processors/cli-scp-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-scp',
    processors: [new CliScpCommandCommandProcessor()],
};

bootCliModule(module);

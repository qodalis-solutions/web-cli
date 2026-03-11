import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliWgetCommandCommandProcessor } from './lib/processors/cli-wget-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-wget',
    processors: [new CliWgetCommandCommandProcessor()],
};

bootCliModule(module);

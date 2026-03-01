import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliStringCommandProcessor } from './lib/processors/cli-string-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-string',
    processors: [new CliStringCommandProcessor()],
};

bootCliModule(module);

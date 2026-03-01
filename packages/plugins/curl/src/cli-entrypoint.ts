import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliCurlCommandProcessor } from './lib/processors/cli-curl-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-curl',
    processors: [new CliCurlCommandProcessor()],
};

bootCliModule(module);

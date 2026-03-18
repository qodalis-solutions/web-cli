import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliCliEncodeCommandProcessor } from './lib/processors/cli-encode-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-encode',
    processors: [new CliCliEncodeCommandProcessor()],
};

bootCliModule(module);

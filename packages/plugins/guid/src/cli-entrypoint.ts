import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliGuidCommandProcessor } from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-guid',
    processors: [new CliGuidCommandProcessor()],
};

bootCliModule(module);

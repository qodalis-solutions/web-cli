import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { Cli2048CommandProcessor } from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-2048',
    processors: [new Cli2048CommandProcessor()],
};

bootCliModule(module);

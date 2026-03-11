import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliSnakeCommandProcessor } from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-snake',
    processors: [new CliSnakeCommandProcessor()],
};

bootCliModule(module);

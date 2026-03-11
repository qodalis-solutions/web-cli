import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliTetrisCommandProcessor } from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-tetris',
    processors: [new CliTetrisCommandProcessor()],
};

bootCliModule(module);

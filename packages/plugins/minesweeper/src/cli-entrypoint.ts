import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliMinesweeperCommandProcessor } from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-minesweeper',
    processors: [new CliMinesweeperCommandProcessor()],
};

bootCliModule(module);

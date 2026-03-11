import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliSudokuCommandProcessor } from './lib/processors/cli-sudoku-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-sudoku',
    processors: [new CliSudokuCommandProcessor()],
};

bootCliModule(module);

/*
 * Public API Surface of sudoku
 */

export * from './lib/processors/cli-sudoku-command-processor';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliSudokuCommandProcessor } from './lib/processors/cli-sudoku-command-processor';
import { API_VERSION } from './lib/version';

export const sudokuModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-sudoku',
    processors: [new CliSudokuCommandProcessor()],
};

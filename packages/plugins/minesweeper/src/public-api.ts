/*
 * Public API Surface of minesweeper
 */

export * from './lib/processors/cli-minesweeper-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliMinesweeperCommandProcessor } from './lib/processors/cli-minesweeper-command-processor';
import { API_VERSION } from './lib/version';

export const minesweeperModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-minesweeper',
    processors: [new CliMinesweeperCommandProcessor()],
};

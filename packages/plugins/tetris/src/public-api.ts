/*
 * Public API Surface of tetris
 */

export * from './lib/processors/cli-tetris-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliTetrisCommandProcessor } from './lib/processors/cli-tetris-command-processor';
import { API_VERSION } from './lib/version';

export const tetrisModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-tetris',
    processors: [new CliTetrisCommandProcessor()],
};

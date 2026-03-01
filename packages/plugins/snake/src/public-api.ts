/*
 * Public API Surface of snake
 */

export * from './lib/processors/cli-snake-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliSnakeCommandProcessor } from './lib/processors/cli-snake-command-processor';
import { API_VERSION } from './lib/version';

export const snakeModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-snake',
    processors: [new CliSnakeCommandProcessor()],
};

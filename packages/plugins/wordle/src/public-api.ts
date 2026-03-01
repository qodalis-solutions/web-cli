/*
 * Public API Surface of wordle
 */

export * from './lib/processors/cli-wordle-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliWordleCommandProcessor } from './lib/processors/cli-wordle-command-processor';
import { API_VERSION } from './lib/version';

export const wordleModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-wordle',
    processors: [new CliWordleCommandProcessor()],
};

/*
 * Public API Surface of 2048
 */

export * from './lib/processors/cli-2048-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { Cli2048CommandProcessor } from './lib/processors/cli-2048-command-processor';
import { API_VERSION } from './lib/version';

export const game2048Module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-2048',
    processors: [new Cli2048CommandProcessor()],
};

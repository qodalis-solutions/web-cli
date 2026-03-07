/*
 * Public API Surface of stopwatch
 */

export * from './lib/processors/cli-stopwatch-command-processor';
export * from './lib/stopwatch-utils';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliStopwatchCommandProcessor } from './lib/processors/cli-stopwatch-command-processor';
import { API_VERSION } from './lib/version';

export const stopwatchModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-stopwatch',
    processors: [new CliStopwatchCommandProcessor()],
};

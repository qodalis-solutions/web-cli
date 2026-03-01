/*
 * Public API Surface of speed-test
 */

export * from './lib/processors/cli-speed-test-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliSpeedTestCommandProcessor } from './lib/processors/cli-speed-test-command-processor';
import { API_VERSION } from './lib/version';

export const speedTestModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-speed-test',
    processors: [new CliSpeedTestCommandProcessor()],
};

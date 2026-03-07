/*
 * Public API Surface of cron
 */

export * from './lib/processors/cli-cron-command-processor';
export * from './lib/cron-utils';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliCronCommandProcessor } from './lib/processors/cli-cron-command-processor';
import { API_VERSION } from './lib/version';

export const cronModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-cron',
    processors: [new CliCronCommandProcessor()],
};

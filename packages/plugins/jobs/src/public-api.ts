/*
 * Public API Surface of jobs
 */

export * from './lib/processors/cli-jobs-command-processor';
export * from './lib/services/cli-jobs-service';
export * from './lib/models';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliJobsCommandProcessor } from './lib/processors/cli-jobs-command-processor';
import { API_VERSION } from './lib/version';

export const jobsModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-jobs',
    processors: [new CliJobsCommandProcessor()],
};

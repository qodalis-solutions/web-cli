/*
 * Public API Surface of jobs
 */

export * from './lib/processors/cli-jobs-command-processor';
export * from './lib/completion/cli-job-name-completion-provider';
export * from './lib/services/cli-jobs-service';
export * from './lib/models';
export * from './lib/version';

import {
    ICliModule,
    ICliCompletionProvider_TOKEN,
} from '@qodalis/cli-core';
import { CliJobsCommandProcessor } from './lib/processors/cli-jobs-command-processor';
import { CliJobNameCompletionProvider } from './lib/completion/cli-job-name-completion-provider';
import { API_VERSION } from './lib/version';

const completionProvider = new CliJobNameCompletionProvider();

export const jobsModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-server-jobs',
    processors: [new CliJobsCommandProcessor()],
    services: [
        {
            provide: ICliCompletionProvider_TOKEN,
            useValue: completionProvider,
            multi: true,
        },
    ],
    async onInit(context) {
        completionProvider.setServices(context.services);
    },
};

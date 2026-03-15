import {
    bootCliModule,
    ICliModule,
    ICliCompletionProvider_TOKEN,
} from '@qodalis/cli-core';
import { CliJobsCommandProcessor } from './lib/processors/cli-jobs-command-processor';
import { CliJobNameCompletionProvider } from './lib/completion/cli-job-name-completion-provider';
import { API_VERSION } from './lib/version';

const completionProvider = new CliJobNameCompletionProvider();

const module: ICliModule = {
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

bootCliModule(module);

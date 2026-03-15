import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliJobsCommandProcessor } from './lib/processors/cli-jobs-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-jobs',
    processors: [new CliJobsCommandProcessor()],
};

bootCliModule(module);

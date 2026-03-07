import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliCronCommandProcessor } from './lib/processors/cli-cron-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-cron',
    processors: [new CliCronCommandProcessor()],
};

bootCliModule(module);

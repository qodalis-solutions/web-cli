import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliCsvCommandProcessor } from './lib/processors/cli-csv-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-csv',
    processors: [new CliCsvCommandProcessor()],
};

bootCliModule(module);

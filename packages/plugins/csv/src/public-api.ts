/*
 * Public API Surface of csv
 */

export * from './lib/processors/cli-csv-command-processor';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliCsvCommandProcessor } from './lib/processors/cli-csv-command-processor';
import { API_VERSION } from './lib/version';

export const csvModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-csv',
    processors: [new CliCsvCommandProcessor()],
};

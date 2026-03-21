/*
 * Public API Surface of data-explorer
 */

export * from './lib/processors/cli-data-explorer-command-processor';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliDataExplorerCommandProcessor } from './lib/processors/cli-data-explorer-command-processor';
import { API_VERSION } from './lib/version';

export const dataExplorerModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-data-explorer',
    processors: [new CliDataExplorerCommandProcessor()],
};

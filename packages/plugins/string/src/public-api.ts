/*
 * Public API Surface of string
 */

export * from './lib/processors/cli-string-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliStringCommandProcessor } from './lib/processors/cli-string-command-processor';
import { API_VERSION } from './lib/version';

export const stringModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-string',
    processors: [new CliStringCommandProcessor()],
};

/*
 * Public API Surface of wget
 */

export * from './lib/processors/cli-wget-command-processor';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliWgetCommandCommandProcessor } from './lib/processors/cli-wget-command-processor';
import { API_VERSION } from './lib/version';

export const wgetModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-wget',
    processors: [new CliWgetCommandCommandProcessor()],
};

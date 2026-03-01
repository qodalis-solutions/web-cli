/*
 * Public API Surface of scp
 */

export * from './lib/processors/cli-scp-command-processor';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliScpCommandCommandProcessor } from './lib/processors/cli-scp-command-processor';
import { API_VERSION } from './lib/version';

export const scpModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-scp',
    processors: [new CliScpCommandCommandProcessor()],
};

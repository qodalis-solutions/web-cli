/*
 * Public API Surface of encode
 */

export * from './lib/processors/cli-encode-command-processor';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliCliEncodeCommandProcessor } from './lib/processors/cli-encode-command-processor';
import { API_VERSION } from './lib/version';

export const encodeModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-encode',
    processors: [new CliCliEncodeCommandProcessor()],
};

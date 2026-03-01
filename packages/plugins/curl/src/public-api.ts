/*
 * Public API Surface of curl
 */

export * from './lib/utilities';
export * from './lib/processors/cli-curl-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliCurlCommandProcessor } from './lib/processors/cli-curl-command-processor';
import { API_VERSION } from './lib/version';

export const curlModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-curl',
    processors: [new CliCurlCommandProcessor()],
};

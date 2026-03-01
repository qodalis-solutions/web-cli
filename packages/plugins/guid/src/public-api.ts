/*
 * Public API Surface of guid
 */

export * from './lib/utilities';

export * from './lib/processors/cli-guid-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliGuidCommandProcessor } from './lib/processors/cli-guid-command-processor';
import { API_VERSION } from './lib/version';

export const guidModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-guid',
    processors: [new CliGuidCommandProcessor()],
};

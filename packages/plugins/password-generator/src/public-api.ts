/*
 * Public API Surface of string
 */

export * from './lib/processors/cli-password-generator-command-processor';

export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliPasswordGeneratorCommandProcessor } from './lib/processors/cli-password-generator-command-processor';
import { API_VERSION } from './lib/version';

export const passwordGeneratorModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-password-generator',
    processors: [new CliPasswordGeneratorCommandProcessor()],
};

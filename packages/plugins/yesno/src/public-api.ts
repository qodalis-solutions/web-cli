/*
 * Public API Surface of yesno
 */

export * from './lib/processors/cli-yesno-command-processor';

export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliYesnoCommandProcessor } from './lib/processors/cli-yesno-command-processor';
import { API_VERSION } from './lib/version';

export const yesnoModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-yesno',
    processors: [new CliYesnoCommandProcessor()],
};

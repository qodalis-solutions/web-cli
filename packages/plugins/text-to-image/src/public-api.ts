/*
 * Public API Surface of text-to-image
 */

export * from './lib/processors/cli-text-to-image-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliTextToImageCommandProcessor } from './lib/processors/cli-text-to-image-command-processor';
import { API_VERSION } from './lib/version';

export const textToImageModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-text-to-image',
    processors: [new CliTextToImageCommandProcessor()],
};

/*
 * Public API Surface of browser-storage
 */

export * from './lib/index';

import { ICliModule } from '@qodalis/cli-core';
import { CliCookiesCommandProcessor } from './lib/processors/cli-cookies-command-processor';
import { CliLocalStorageCommandProcessor } from './lib/processors/cli-local-storage-command-processor';
import { API_VERSION } from './lib/version';

export const browserStorageModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-browser-storage',
    processors: [
        new CliCookiesCommandProcessor(),
        new CliLocalStorageCommandProcessor(),
    ],
};

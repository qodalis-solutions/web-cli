/*
 * Public API Surface of qr
 */

export * from './lib/processors/cli-qr-command-processor';

export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliQrCommandProcessor } from './lib/processors/cli-qr-command-processor';
import { API_VERSION } from './lib/version';

export const qrModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-qr',
    processors: [new CliQrCommandProcessor()],
};

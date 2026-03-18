/*
 * Public API Surface of encode
 */

export * from './lib';

import { ICliModule } from '@qodalis/cli-core';
import { CliBase64CommandProcessor } from './lib/processors/cli-base64-command-processor';
import { CliHexCommandProcessor } from './lib/processors/cli-hex-command-processor';
import { CliUrlCommandProcessor } from './lib/processors/cli-url-command-processor';
import { CliHashCommandProcessor } from './lib/processors/cli-hash-command-processor';
import { CliJwtCommandProcessor } from './lib/processors/cli-jwt-command-processor';
import { CliBinaryCommandProcessor } from './lib/processors/cli-binary-command-processor';
import { CliRotCommandProcessor } from './lib/processors/cli-rot-command-processor';
import { CliMorseCommandProcessor } from './lib/processors/cli-morse-command-processor';
import { API_VERSION } from './lib/version';

export const encodeModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-encode',
    processors: [
        new CliBase64CommandProcessor(),
        new CliHexCommandProcessor(),
        new CliUrlCommandProcessor(),
        new CliHashCommandProcessor(),
        new CliJwtCommandProcessor(),
        new CliBinaryCommandProcessor(),
        new CliRotCommandProcessor(),
        new CliMorseCommandProcessor(),
    ],
};

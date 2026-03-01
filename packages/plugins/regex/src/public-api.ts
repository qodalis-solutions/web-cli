/*
 * Public API Surface of regex
 */

export * from './lib/processors/cli-regex-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliRegexCommandProcessor } from './lib/processors/cli-regex-command-processor';
import { API_VERSION } from './lib/version';

export const regexModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-regex',
    processors: [new CliRegexCommandProcessor()],
};

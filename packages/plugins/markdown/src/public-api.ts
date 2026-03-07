/*
 * Public API Surface of markdown
 */

export * from './lib/processors/cli-markdown-command-processor';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliMarkdownCommandProcessor } from './lib/processors/cli-markdown-command-processor';
import { API_VERSION } from './lib/version';

export const markdownModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-markdown',
    processors: [new CliMarkdownCommandProcessor()],
};

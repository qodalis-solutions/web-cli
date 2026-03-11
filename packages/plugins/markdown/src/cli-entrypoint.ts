import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliMarkdownCommandProcessor } from './lib/processors/cli-markdown-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-markdown',
    processors: [new CliMarkdownCommandProcessor()],
};

bootCliModule(module);

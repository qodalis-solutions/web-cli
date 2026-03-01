import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliTextToImageCommandProcessor } from './lib/processors/cli-text-to-image-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-text-to-image',
    processors: [new CliTextToImageCommandProcessor()],
};

bootCliModule(module);

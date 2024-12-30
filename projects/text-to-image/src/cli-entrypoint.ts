import { bootUmdModule, ICliUmdModule } from '@qodalis/cli-core';
import { CliTextToImageCommandProcessor } from './lib/processors/cli-text-to-image-command-processor';

const module: ICliUmdModule = {
    name: '@qodalis/cli-text-to-image',
    processors: [new CliTextToImageCommandProcessor()],
};

bootUmdModule(module);

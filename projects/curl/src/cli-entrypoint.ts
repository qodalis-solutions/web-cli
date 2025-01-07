import { bootUmdModule, ICliUmdModule } from '@qodalis/cli-core';
import { CliCurlCommandProcessor } from './lib/processors/cli-curl-command-processor';

const module: ICliUmdModule = {
    name: '@qodalis/cli-curl',
    processors: [new CliCurlCommandProcessor()],
};

bootUmdModule(module);

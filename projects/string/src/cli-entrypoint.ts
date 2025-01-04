import { bootUmdModule, ICliUmdModule } from '@qodalis/cli-core';
import { CliStringCommandProcessor } from './lib/processors/cli-string-command-processor';

const module: ICliUmdModule = {
    name: '@qodalis/cli-string',
    processors: [new CliStringCommandProcessor()],
};

bootUmdModule(module);

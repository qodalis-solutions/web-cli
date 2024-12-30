import { bootUmdModule, ICliUmdModule } from '@qodalis/cli-core';
import { CliGuidCommandProcessor } from './lib';

const module: ICliUmdModule = {
    name: '@qodalis/cli-guid',
    processors: [new CliGuidCommandProcessor()],
};

bootUmdModule(module);

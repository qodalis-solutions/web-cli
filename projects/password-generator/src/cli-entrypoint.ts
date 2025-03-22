import { bootUmdModule, ICliUmdModule } from '@qodalis/cli-core';
import { CliPasswordGeneratorCommandProcessor } from './lib/processors/cli-password-generator-command-processor';

const module: ICliUmdModule = {
    name: '@qodalis/cli-password-generator',
    processors: [new CliPasswordGeneratorCommandProcessor()],
};

bootUmdModule(module);

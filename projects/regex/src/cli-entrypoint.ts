import { bootUmdModule, ICliUmdModule } from '@qodalis/cli-core';
import { CliRegexCommandProcessor } from './lib';

const module: ICliUmdModule = {
    name: '@qodalis/cli-regex',
    processors: [new CliRegexCommandProcessor()],
};

bootUmdModule(module);

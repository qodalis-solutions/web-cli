import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliRegexCommandProcessor } from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-regex',
    processors: [new CliRegexCommandProcessor()],
};

bootCliModule(module);

import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliPasswordGeneratorCommandProcessor } from './lib/processors/cli-password-generator-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-password-generator',
    processors: [new CliPasswordGeneratorCommandProcessor()],
};

bootCliModule(module);

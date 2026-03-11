import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliWordleCommandProcessor } from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-wordle',
    processors: [new CliWordleCommandProcessor()],
};

bootCliModule(module);

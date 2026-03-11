import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliYesnoCommandProcessor } from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-yesno',
    processors: [new CliYesnoCommandProcessor()],
};

bootCliModule(module);

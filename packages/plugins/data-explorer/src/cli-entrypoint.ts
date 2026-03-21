import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliDataExplorerCommandProcessor } from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-data-explorer',
    processors: [new CliDataExplorerCommandProcessor()],
};

bootCliModule(module);

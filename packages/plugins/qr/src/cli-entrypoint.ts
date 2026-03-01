import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliQrCommandProcessor } from './lib/processors/cli-qr-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-qr',
    processors: [new CliQrCommandProcessor()],
};

bootCliModule(module);

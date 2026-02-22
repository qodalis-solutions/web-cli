import { bootUmdModule, ICliUmdModule } from '@qodalis/cli-core';
import { CliQrCommandProcessor } from './lib/processors/cli-qr-command-processor';

const module: ICliUmdModule = {
    name: '@qodalis/cli-qr',
    processors: [new CliQrCommandProcessor()],
};

bootUmdModule(module);

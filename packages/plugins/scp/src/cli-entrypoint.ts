import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliScpCommandCommandProcessor } from './lib/processors/cli-scp-command-processor';
import { ScpTransferService } from './lib/services/scp-transfer.service';
import { IScpTransferService_TOKEN } from './lib/interfaces';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-scp',
    processors: [new CliScpCommandCommandProcessor()],
    services: [
        {
            provide: IScpTransferService_TOKEN,
            useClass: ScpTransferService,
        },
    ],
};

bootCliModule(module);

import { bootUmdModule, ICliUmdModule } from '@qodalis/cli-core';
import { CliLogsCommandProcessor } from './lib/processors/cli-logs-command-processor';

const module: ICliUmdModule = {
    name: '@qodalis/cli-server-logs',
    processors: [new CliLogsCommandProcessor()],
    dependencies: [
        {
            name: 'signalR',
            version: 'latest',
            url: 'https://unpkg.com/@microsoft/signalr@8.0.7/dist/browser/signalr.js',
        },
    ],
};

bootUmdModule(module);

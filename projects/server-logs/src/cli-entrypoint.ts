import { ICliUmdModule } from '@qodalis/cli-core';
import { CliLogsCommandProcessor } from './lib/processors/cli-logs-command-processor';

if (typeof window !== 'undefined') {
    const module: ICliUmdModule = {
        processors: [new CliLogsCommandProcessor()],
        dependencies: [
            {
                name: 'signalR',
                version: 'latest',
                url: 'https://unpkg.com/@microsoft/signalr@8.0.7/dist/browser/signalr.js',
            },
        ],
    };

    (module as any).Injectable = () => {};

    (window as any)['@qodalis/cli-server-logs'] = module;
} else {
    console.log('window is undefined');
}

import { bootCliModule } from '@qodalis/cli-core';
import { CliLogsCommandProcessor } from './lib/processors/cli-logs-command-processor';
import { API_VERSION } from './lib/version';

bootCliModule({
    apiVersion: API_VERSION,
    name: '@qodalis/cli-server-logs',
    processors: [new CliLogsCommandProcessor()],
});

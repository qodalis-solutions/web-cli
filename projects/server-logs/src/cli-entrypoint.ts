import { bootUmdModule } from '@qodalis/cli-core';
import { CliLogsCommandProcessor } from './lib/processors/cli-logs-command-processor';

bootUmdModule({
    name: '@qodalis/cli-server-logs',
    processors: [new CliLogsCommandProcessor()],
});

/*
 * Public API Surface of server-logs
 */

export * from './lib/processors/cli-logs-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliLogsCommandProcessor } from './lib/processors/cli-logs-command-processor';
import { API_VERSION } from './lib/version';

export const serverLogsModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-server-logs',
    processors: [new CliLogsCommandProcessor()],
};

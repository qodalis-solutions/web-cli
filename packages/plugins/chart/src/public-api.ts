/*
 * Public API Surface of chart
 */

export * from './lib/processors/cli-chart-command-processor';
export * from './lib/chart-utils';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliChartCommandProcessor } from './lib/processors/cli-chart-command-processor';
import { API_VERSION } from './lib/version';

export const chartModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-chart',
    processors: [new CliChartCommandProcessor()],
};

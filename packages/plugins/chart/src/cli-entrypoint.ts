import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliChartCommandProcessor } from './lib/processors/cli-chart-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-chart',
    processors: [new CliChartCommandProcessor()],
};

bootCliModule(module);

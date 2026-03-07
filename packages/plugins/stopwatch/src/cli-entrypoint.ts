import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliStopwatchCommandProcessor } from './lib/processors/cli-stopwatch-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-stopwatch',
    processors: [new CliStopwatchCommandProcessor()],
};

bootCliModule(module);

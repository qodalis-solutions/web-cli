import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliSpeedTestCommandProcessor } from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-speed-test',
    processors: [new CliSpeedTestCommandProcessor()],
};

bootCliModule(module);

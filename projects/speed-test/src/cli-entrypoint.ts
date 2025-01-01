import { bootUmdModule, ICliUmdModule } from '@qodalis/cli-core';
import { CliSpeedTestCommandProcessor } from './lib';

const module: ICliUmdModule = {
    name: '@qodalis/cli-speed-test',
    processors: [new CliSpeedTestCommandProcessor()],
};

bootUmdModule(module);

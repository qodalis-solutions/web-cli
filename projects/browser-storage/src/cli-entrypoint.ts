import { bootUmdModule, ICliUmdModule } from '@qodalis/cli-core';
import {
    CliCookiesCommandProcessor,
    CliLocalStorageCommandProcessor,
} from './lib/';

const module: ICliUmdModule = {
    name: '@qodalis/cli-browser-storage',
    processors: [
        new CliCookiesCommandProcessor(),
        new CliLocalStorageCommandProcessor(),
    ],
};

bootUmdModule(module);

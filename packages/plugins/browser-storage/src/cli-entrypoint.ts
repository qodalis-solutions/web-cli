import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import {
    CliCookiesCommandProcessor,
    CliLocalStorageCommandProcessor,
} from './lib/';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-browser-storage',
    processors: [
        new CliCookiesCommandProcessor(),
        new CliLocalStorageCommandProcessor(),
    ],
};

bootCliModule(module);

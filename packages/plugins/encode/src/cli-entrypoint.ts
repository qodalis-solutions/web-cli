import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import {
    CliBase64CommandProcessor,
    CliHexCommandProcessor,
    CliUrlCommandProcessor,
    CliHashCommandProcessor,
    CliJwtCommandProcessor,
    CliBinaryCommandProcessor,
    CliRotCommandProcessor,
    CliMorseCommandProcessor,
} from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-encode',
    processors: [
        new CliBase64CommandProcessor(),
        new CliHexCommandProcessor(),
        new CliUrlCommandProcessor(),
        new CliHashCommandProcessor(),
        new CliJwtCommandProcessor(),
        new CliBinaryCommandProcessor(),
        new CliRotCommandProcessor(),
        new CliMorseCommandProcessor(),
    ],
};

bootCliModule(module);

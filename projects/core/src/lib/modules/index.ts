import { constants } from '../constants';
import { ICliUmdModule } from '../interfaces';
import { utils } from '../utils';

const global = window as any;

export const initializeBrowserEnvironment = ({
    handlers,
}: {
    handlers: ((module: ICliUmdModule) => Promise<void>)[];
}): void => {
    global.core = {
        onUmdModuleBoot: handlers || [],
        bootUmdModule: async (module: ICliUmdModule) => {
            console.log('Booting UMD module', module.name);
            global[module.name] = module;
            handlers.forEach(async (handler) => await handler(module));
        },
        Injectable: () => {},
        ...constants,
        ...utils,
    };

    (window as any).ngCore = {
        Injectable: () => {},
    };
};

export const bootUmdModule = async (module: ICliUmdModule): Promise<void> => {
    if (typeof global !== 'undefined') {
        await global.core.bootUmdModule(module);
    } else {
        console.log('window is undefined');
    }
};

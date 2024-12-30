import { constants } from '../constants';
import { ICliUmdModule } from '../interfaces';
import { utils } from '../utils';

export const initializeBrowserEnvironment = ({
    handlers,
}: {
    handlers: ((module: ICliUmdModule) => Promise<void>)[];
}): void => {
    (window as any).cliCore = {
        onUmdModuleBoot: handlers || [],
        bootUmdModule: async (module: ICliUmdModule) => {
            console.log('Booting UMD module', module.name);
            (window as any)[module.name] = module;
            handlers.forEach(async (handler) => await handler(module));
        },
        ...constants,
        ...utils,
    };

    (window as any).ngCore = {
        Injectable: () => {},
    };
};

export const bootUmdModule = async (module: ICliUmdModule): Promise<void> => {
    if (typeof (window as any) !== 'undefined') {
        await (window as any).cliCore.bootUmdModule(module);
    } else {
        console.log('window is undefined');
    }
};

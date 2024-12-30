import { constants } from '../constants';
import { ICliUmdModule } from '../interfaces';
import { utils } from '../utils';

export type CoreModuleProps = {
    onUmdModuleBoot: ((module: ICliUmdModule) => Promise<void>)[];
    bootUmdModule: (module: ICliUmdModule) => Promise<void>;
    Injectable: () => {};
};

export const initializeBrowserEnvironment = ({
    handlers,
}: {
    handlers: ((module: ICliUmdModule) => Promise<void>)[];
}): void => {
    (window as any).core = {
        onUmdModuleBoot: handlers || [],
        bootUmdModule: async (module: ICliUmdModule) => {
            handlers.forEach(async (handler) => await handler(module));
        },
        Injectable: () => ({}),
        ...constants,
        ...utils,
    };
};

export const bootUmdModule = async (module: ICliUmdModule): Promise<void> => {
    if (typeof window !== 'undefined') {
        (window as any)[module.name] = module;

        await (window as any).core.bootUmdModule(module);
    } else {
        console.log('window is undefined');
    }
};

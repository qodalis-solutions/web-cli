import { enums } from '../models';
import { constants } from '../constants';
import { ICliExecutionContext, ICliUmdModule } from '../interfaces';
import { utils } from '../utils';

export const initializeBrowserEnvironment = ({
    context,
    handlers,
}: {
    context: ICliExecutionContext;
    handlers: ((module: ICliUmdModule) => Promise<void>)[];
}): void => {
    (window as any).cliCore = {
        onUmdModuleBoot: handlers || [],
        bootUmdModule: async (module: ICliUmdModule) => {
            context.logger.log('Booting UMD module', module.name);
            (window as any)[module.name] = module;
            handlers.forEach(async (handler) => await handler(module));
        },
        ...constants,
        ...utils,
        ...enums,
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

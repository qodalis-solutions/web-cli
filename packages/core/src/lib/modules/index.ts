import { enums } from '../models';
import { constants } from '../constants';
import { ICliExecutionContext, ICliModule } from '../interfaces';
import { utils } from '../utils';
import { CliModuleRegistry } from './cli-module-registry';

export { CliModuleRegistry } from './cli-module-registry';

export const initializeBrowserEnvironment = ({
    context,
    registry,
}: {
    context: ICliExecutionContext;
    registry: CliModuleRegistry;
}): void => {
    // Expose the registry as the single clean global for UMD module loading
    (window as any).__cliModuleRegistry = registry;

    // Expose core utilities and boot functions for UMD modules
    (window as any).cliCore = {
        ...constants,
        ...utils,
        ...enums,
        bootCliModule,
        bootUmdModule,
    };

    // Safety warning for any UMD module trying to use Angular decorators
    Object.defineProperty(window, 'ngCore', {
        configurable: true,
        get() {
            console.warn(
                'CLI: Angular decorators are not supported in UMD modules. ' +
                    'Use plain classes instead.',
            );
            return { Injectable: () => () => {} };
        },
    });
};

/**
 * Boot a CLI module by registering it with the global module registry.
 * Used by UMD entrypoints to register themselves when loaded dynamically.
 */
export const bootCliModule = async (module: ICliModule): Promise<void> => {
    if (typeof window !== 'undefined' && (window as any).__cliModuleRegistry) {
        await (window as any).__cliModuleRegistry.register(module);
    }
};

/**
 * @deprecated Use bootCliModule instead
 */
export const bootUmdModule = async (module: ICliModule): Promise<void> => {
    await bootCliModule(module);
};

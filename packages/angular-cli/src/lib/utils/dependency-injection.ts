import { InjectionToken, Provider } from '@angular/core';
import { ICliCommandProcessor, ICliModule } from '@qodalis/cli-core';
import { CliCommandProcessor_TOKEN, CliModule_TOKEN } from '../cli/tokens';

export const resolveCliProvider = <T>(
    token: InjectionToken<T>,
    provider: new (...args: any[]) => T,
): Provider => ({
    provide: token,
    useExisting: provider,
    multi: true,
});

/**
 * @deprecated Use resolveCliModuleProvider() instead.
 */
export const resolveCommandProcessorProvider = <T extends ICliCommandProcessor>(
    provider: new (...args: any[]) => T,
): Provider => [
    provider,
    resolveCliProvider<T>(CliCommandProcessor_TOKEN, provider),
];

/**
 * Resolve an ICliModule into Angular providers.
 * Registers the module via CliModule_TOKEN and also registers processors
 * individually via CliCommandProcessor_TOKEN for backward compatibility.
 */
export const resolveCliModuleProvider = (module: ICliModule): Provider[] => {
    const providers: Provider[] = [
        {
            provide: CliModule_TOKEN,
            useValue: module,
            multi: true,
        },
    ];

    if (module.processors) {
        for (const processor of module.processors) {
            providers.push({
                provide: CliCommandProcessor_TOKEN,
                useValue: processor,
                multi: true,
            });
        }
    }

    return providers;
};

import { InjectionToken, Provider } from '@angular/core';
import { ICliModule } from '@qodalis/cli-core';
import { CliModule_TOKEN } from '../cli/tokens';

export const resolveCliProvider = <T>(
    token: InjectionToken<T>,
    provider: new (...args: any[]) => T,
): Provider => ({
    provide: token,
    useExisting: provider,
    multi: true,
});

/**
 * Resolve an ICliModule into Angular providers: the module is registered
 * via CliModule_TOKEN and booted by every `<cli>` / `<cli-panel>`.
 */
export const resolveCliModuleProvider = (module: ICliModule): Provider[] => [
    {
        provide: CliModule_TOKEN,
        useValue: module,
        multi: true,
    },
];

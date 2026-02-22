import { InjectionToken, Provider } from '@angular/core';
import { ICliCommandProcessor } from '@qodalis/cli-core';
import { CliCommandProcessor_TOKEN } from '../cli/tokens';

export const resolveCliProvider = <T>(
    token: InjectionToken<T>,
    provider: new (...args: any[]) => T,
): Provider => ({
    provide: token,
    useExisting: provider,
    multi: true,
});

export const resolveCommandProcessorProvider = <T extends ICliCommandProcessor>(
    provider: new (...args: any[]) => T,
): Provider => [
    provider,
    resolveCliProvider<T>(CliCommandProcessor_TOKEN, provider),
];

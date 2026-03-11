import { inject } from 'vue';
import { CliInjectionKey, CliContextValue } from './cliInjection';

export function useCli(): CliContextValue {
    const ctx = inject(CliInjectionKey);
    if (!ctx) {
        throw new Error(
            'useCli() must be used inside a <CliProvider> component',
        );
    }
    return ctx;
}

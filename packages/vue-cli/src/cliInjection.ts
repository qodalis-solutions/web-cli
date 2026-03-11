import { InjectionKey, Ref } from 'vue';
import { CliEngine } from '@qodalis/cli';

export interface CliContextValue {
    engine: Ref<CliEngine | null>;
}

export const CliInjectionKey: InjectionKey<CliContextValue> =
    Symbol('qodalis-cli');

import { defineComponent, provide, PropType, InjectionKey } from 'vue';
import { ICliModule } from '@qodalis/cli-core';
import { CliEngineOptions } from '@qodalis/cli';

export interface CliConfigValue {
    modules?: ICliModule[];
    options?: CliEngineOptions;
    services?: Record<string, any>;
}

export const CliConfigKey: InjectionKey<CliConfigValue> =
    Symbol('qodalis-cli-config');

export const CliConfigProvider = defineComponent({
    name: 'CliConfigProvider',
    props: {
        modules: {
            type: Array as PropType<ICliModule[]>,
            default: undefined,
        },
        options: {
            type: Object as PropType<CliEngineOptions>,
            default: undefined,
        },
        services: {
            type: Object as PropType<Record<string, any>>,
            default: undefined,
        },
    },
    setup(props, { slots }) {
        provide(CliConfigKey, {
            modules: props.modules,
            options: props.options,
            services: props.services,
        });

        return () => slots.default?.();
    },
});

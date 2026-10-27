import { defineComponent, ref, PropType, h, provide } from 'vue';
import { ICliModule } from '@qodalis/cli-core';
import { CliEngineOptions } from '@qodalis/cli';
import { CliInjectionKey } from './cliInjection';
import { useCliEngine } from './useCliEngine';

export const CliProvider = defineComponent({
    name: 'CliProvider',
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
        style: {
            type: Object as PropType<Record<string, string>>,
            default: undefined,
        },
    },
    emits: ['ready'],
    setup(props, { slots, emit }) {
        const containerRef = ref<HTMLElement | null>(null);
        const engine = useCliEngine(containerRef, {
            modules: props.modules,
            options: props.options,
            services: props.services,
        });

        provide(CliInjectionKey, { engine });

        return () =>
            h('div', { style: { height: '100%' } }, [
                h('div', {
                    ref: containerRef,
                    style: { height: '100%', ...props.style },
                }),
                slots.default?.(),
            ]);
    },
});

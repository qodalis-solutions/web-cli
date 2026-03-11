import {
    defineComponent,
    ref,
    onMounted,
    onBeforeUnmount,
    PropType,
    h,
    inject,
} from 'vue';
import { ICliCommandProcessor, ICliModule, CliEngineSnapshot } from '@qodalis/cli-core';
import { CliEngine, CliEngineOptions } from '@qodalis/cli';
import { CliInjectionKey } from './cliInjection';
import { CliConfigKey } from './CliConfigProvider';

export const Cli = defineComponent({
    name: 'Cli',
    props: {
        modules: {
            type: Array as PropType<ICliModule[]>,
            default: undefined,
        },
        processors: {
            type: Array as PropType<ICliCommandProcessor[]>,
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
        snapshot: {
            type: Object as PropType<CliEngineSnapshot>,
            default: undefined,
        },
        style: {
            type: Object as PropType<Record<string, string>>,
            default: undefined,
        },
        class: {
            type: String,
            default: undefined,
        },
    },
    emits: ['ready'],
    setup(props, { emit }) {
        const containerRef = ref<HTMLElement | null>(null);
        const ctx = inject(CliInjectionKey, null);
        const config = inject(CliConfigKey, null);
        let engine: CliEngine | null = null;

        // If inside a CliProvider, don't create our own engine
        if (ctx) {
            return () => null;
        }

        // Merge: local props override config context
        const modules = props.modules ?? config?.modules;
        const processors = props.processors ?? config?.processors;
        const options = props.options ?? config?.options;
        const services = props.services ?? config?.services;

        onMounted(async () => {
            if (!containerRef.value) return;

            const engineOptions = props.snapshot
                ? { ...options, snapshot: props.snapshot }
                : options;
            engine = new CliEngine(containerRef.value, engineOptions);

            engine.registerService('cli-framework', 'Vue');

            if (services) {
                for (const [token, value] of Object.entries(services)) {
                    engine.registerService(token, value);
                }
            }

            if (modules) {
                engine.registerModules(modules);
            }

            if (processors) {
                engine.registerProcessors(processors);
            }

            await engine.start();
            emit('ready', engine);
        });

        onBeforeUnmount(() => {
            engine?.destroy();
            engine = null;
        });

        return () =>
            h('div', {
                ref: containerRef,
                style: { height: '100%', ...props.style },
                class: props.class,
            });
    },
});

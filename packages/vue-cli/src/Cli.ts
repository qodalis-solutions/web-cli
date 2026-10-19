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
import { CliEngine, CliEngineOptions, createCliEngine, resolveCliHostConfig } from '@qodalis/cli';
import { CliInjectionKey } from './cliInjection';
import { CliConfigKey } from './CliConfigProvider';

/**
 * Props accepted by the Vue `Cli` component.
 */
export interface CliProps {
    modules?: ICliModule[];
    processors?: ICliCommandProcessor[];
    options?: CliEngineOptions;
    services?: Record<string, any>;
    snapshot?: CliEngineSnapshot;
    style?: Record<string, string>;
    class?: string;
}

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

        // Local props override the config context.
        const hostConfig = resolveCliHostConfig(props, config);

        onMounted(async () => {
            if (!containerRef.value) return;

            engine = createCliEngine(containerRef.value, { ...hostConfig, snapshot: props.snapshot, framework: 'Vue' });
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

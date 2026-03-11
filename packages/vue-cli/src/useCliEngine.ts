import { ref, onMounted, onBeforeUnmount, Ref, shallowRef } from 'vue';
import { CliEngine, CliEngineOptions } from '@qodalis/cli';
import { ICliCommandProcessor, ICliModule } from '@qodalis/cli-core';

export interface UseCliEngineConfig {
    modules?: ICliModule[];
    processors?: ICliCommandProcessor[];
    options?: CliEngineOptions;
    services?: Record<string, any>;
}

export function useCliEngine(
    containerRef: Ref<HTMLElement | null>,
    config?: UseCliEngineConfig,
): Ref<CliEngine | null> {
    const engine = shallowRef<CliEngine | null>(null);

    onMounted(async () => {
        if (!containerRef.value) return;

        const e = new CliEngine(containerRef.value, config?.options);

        e.registerService('cli-framework', 'Vue');

        if (config?.services) {
            for (const [token, value] of Object.entries(config.services)) {
                e.registerService(token, value);
            }
        }

        if (config?.modules) {
            e.registerModules(config.modules);
        }

        if (config?.processors) {
            e.registerProcessors(config.processors);
        }

        await e.start();
        engine.value = e;
    });

    onBeforeUnmount(() => {
        engine.value?.destroy();
        engine.value = null;
    });

    return engine;
}

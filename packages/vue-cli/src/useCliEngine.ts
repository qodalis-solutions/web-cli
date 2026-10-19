import { onMounted, onBeforeUnmount, Ref, shallowRef } from 'vue';
import { CliEngine, CreateCliEngineConfig, createCliEngine } from '@qodalis/cli';

export type UseCliEngineConfig = Omit<CreateCliEngineConfig, 'framework'>;

export function useCliEngine(
    containerRef: Ref<HTMLElement | null>,
    config?: UseCliEngineConfig,
): Ref<CliEngine | null> {
    const engine = shallowRef<CliEngine | null>(null);

    onMounted(async () => {
        if (!containerRef.value) return;

        const e = createCliEngine(containerRef.value, { ...config, framework: 'Vue' });
        await e.start();
        engine.value = e;
    });

    onBeforeUnmount(() => {
        engine.value?.destroy();
        engine.value = null;
    });

    return engine;
}

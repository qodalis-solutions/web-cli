import { useRef, useEffect, useState, RefObject } from 'react';
import { CliEngine, CliEngineOptions } from '@qodalis/cli';
import { ICliCommandProcessor, ICliModule } from '@qodalis/cli-core';

export interface UseCliEngineConfig {
    modules?: ICliModule[];
    processors?: ICliCommandProcessor[];
    options?: CliEngineOptions;
    services?: Record<string, any>;
    disabled?: boolean;
}

export function useCliEngine(
    containerRef: RefObject<HTMLElement | null>,
    config?: UseCliEngineConfig,
): CliEngine | null {
    const [engine, setEngine] = useState<CliEngine | null>(null);
    const engineRef = useRef<CliEngine | null>(null);
    const initTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (config?.disabled || !containerRef.current) return;

        // Defer initialization slightly so that StrictMode's immediate
        // unmount (mount → unmount → remount) cancels the first attempt
        // via the cleanup function, while non-StrictMode proceeds normally.
        const container = containerRef.current;
        initTimerRef.current = setTimeout(() => {
            initTimerRef.current = null;
            if (!container) return;

            const e = new CliEngine(container, config?.options);

            e.registerService('cli-framework', 'React');

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

            engineRef.current = e;
            e.start().then(() => setEngine(e));
        }, 0);

        return () => {
            if (initTimerRef.current !== null) {
                clearTimeout(initTimerRef.current);
                initTimerRef.current = null;
                return;
            }
            if (engineRef.current) {
                engineRef.current.destroy();
                engineRef.current = null;
                setEngine(null);
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return engine;
}

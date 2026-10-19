import { useRef, useEffect, useState, RefObject } from 'react';
import { CliEngine, CreateCliEngineConfig, createCliEngine } from '@qodalis/cli';

export interface UseCliEngineConfig extends Omit<CreateCliEngineConfig, 'framework'> {
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

            const e = createCliEngine(container, { ...config, framework: 'React' });

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

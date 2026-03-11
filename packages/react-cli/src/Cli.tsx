import React, { useRef, useEffect } from 'react';
import { ICliCommandProcessor, ICliModule, CliEngineSnapshot } from '@qodalis/cli-core';
import { CliEngine, CliEngineOptions } from '@qodalis/cli';
import { useCli } from './CliContext';
import { useCliConfig } from './CliConfigContext';
import { useCliEngine } from './useCliEngine';

export interface CliProps {
    modules?: ICliModule[];
    processors?: ICliCommandProcessor[];
    options?: CliEngineOptions;
    services?: Record<string, any>;
    snapshot?: CliEngineSnapshot;
    onReady?: (engine: CliEngine) => void;
    style?: React.CSSProperties;
    className?: string;
}

export function Cli({
    modules,
    processors,
    options,
    services,
    snapshot,
    onReady,
    style,
    className,
}: CliProps): React.JSX.Element {
    const ctx = useCli();
    const config = useCliConfig();
    const containerRef = useRef<HTMLDivElement>(null);
    const hasProvider = !!ctx.engine;

    // Merge: local props override global config
    const mergedModules = modules ?? config.modules;
    const mergedProcessors = processors ?? config.processors;
    const mergedOptions = options ?? config.options;
    const mergedServices = services ?? config.services;
    const optionsWithSnapshot = snapshot
        ? { ...mergedOptions, snapshot }
        : mergedOptions;

    // Always call the hook (React rules), but disable it when inside a CliProvider.
    const standaloneEngine = useCliEngine(containerRef, {
        modules: mergedModules,
        processors: mergedProcessors,
        options: optionsWithSnapshot,
        services: mergedServices,
        disabled: hasProvider,
    });

    const engine = ctx.engine ?? standaloneEngine;

    useEffect(() => {
        if (engine && onReady) {
            onReady(engine);
        }
    }, [engine, onReady]);

    // If inside a CliProvider, render nothing (provider has the terminal div).
    if (hasProvider) {
        return <></>;
    }

    return (
        <div
            ref={containerRef}
            style={{ height: '100%', ...style }}
            className={className}
        />
    );
}

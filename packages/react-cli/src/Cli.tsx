import React, { useRef, useEffect } from 'react';
import { ICliModule, CliEngineSnapshot } from '@qodalis/cli-core';
import { CliEngine, CliEngineOptions, resolveCliHostConfig } from '@qodalis/cli';
import { useCli } from './CliContext';
import { useCliConfig } from './CliConfigContext';
import { useCliEngine } from './useCliEngine';

export interface CliProps {
    modules?: ICliModule[];
    options?: CliEngineOptions;
    services?: Record<string, any>;
    snapshot?: CliEngineSnapshot;
    onReady?: (engine: CliEngine) => void;
    style?: React.CSSProperties;
    className?: string;
}

export function Cli({
    modules,
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

    // Always call the hook (React rules), but disable it when inside a CliProvider.
    const standaloneEngine = useCliEngine(containerRef, {
        ...resolveCliHostConfig({ modules, options, services }, config),
        snapshot,
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

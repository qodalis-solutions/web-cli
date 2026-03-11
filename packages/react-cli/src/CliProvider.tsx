import React, { useRef } from 'react';
import { ICliCommandProcessor, ICliModule } from '@qodalis/cli-core';
import { CliEngineOptions } from '@qodalis/cli';
import { CliContext } from './CliContext';
import { useCliConfig } from './CliConfigContext';
import { useCliEngine } from './useCliEngine';

export interface CliProviderProps {
    modules?: ICliModule[];
    processors?: ICliCommandProcessor[];
    options?: CliEngineOptions;
    services?: Record<string, any>;
    children: React.ReactNode;
    style?: React.CSSProperties;
}

export function CliProvider({
    modules,
    processors,
    options,
    services,
    children,
    style,
}: CliProviderProps): React.JSX.Element {
    const config = useCliConfig();
    const containerRef = useRef<HTMLDivElement>(null);
    const engine = useCliEngine(containerRef, {
        modules: modules ?? config.modules,
        processors: processors ?? config.processors,
        options: options ?? config.options,
        services: services ?? config.services,
    });

    return (
        <CliContext.Provider value={{ engine }}>
            <div ref={containerRef} style={{ height: '100%', ...style }} />
            {children}
        </CliContext.Provider>
    );
}

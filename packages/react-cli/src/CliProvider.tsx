import React, { useRef } from 'react';
import { ICliCommandProcessor, ICliModule } from '@qodalis/cli-core';
import { CliEngineOptions, resolveCliHostConfig } from '@qodalis/cli';
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
    const engine = useCliEngine(containerRef, resolveCliHostConfig({ modules, processors, options, services }, config));

    return (
        <CliContext.Provider value={{ engine }}>
            <div ref={containerRef} style={{ height: '100%', ...style }} />
            {children}
        </CliContext.Provider>
    );
}

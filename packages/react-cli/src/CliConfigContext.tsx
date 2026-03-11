import React, { createContext, useContext } from 'react';
import { ICliCommandProcessor, ICliModule, CliOptions } from '@qodalis/cli-core';
import { CliEngineOptions } from '@qodalis/cli';

export interface CliConfigValue {
    modules?: ICliModule[];
    processors?: ICliCommandProcessor[];
    options?: CliEngineOptions;
    services?: Record<string, any>;
}

const CliConfigCtx = createContext<CliConfigValue>({});

export function useCliConfig(): CliConfigValue {
    return useContext(CliConfigCtx);
}

export interface CliConfigProviderProps extends CliConfigValue {
    children: React.ReactNode;
}

export function CliConfigProvider({
    modules,
    processors,
    options,
    services,
    children,
}: CliConfigProviderProps): React.JSX.Element {
    return (
        <CliConfigCtx.Provider value={{ modules, processors, options, services }}>
            {children}
        </CliConfigCtx.Provider>
    );
}

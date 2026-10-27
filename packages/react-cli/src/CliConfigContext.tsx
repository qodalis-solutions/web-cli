import React, { createContext, useContext } from 'react';
import { ICliModule, CliOptions } from '@qodalis/cli-core';
import { CliEngineOptions } from '@qodalis/cli';

export interface CliConfigValue {
    modules?: ICliModule[];
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
    options,
    services,
    children,
}: CliConfigProviderProps): React.JSX.Element {
    return (
        <CliConfigCtx.Provider value={{ modules, options, services }}>
            {children}
        </CliConfigCtx.Provider>
    );
}

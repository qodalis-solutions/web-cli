import { createContext, useContext } from 'react';
import { CliEngine } from '@qodalis/cli';

export interface CliContextValue {
    engine: CliEngine | null;
}

export const CliContext = createContext<CliContextValue>({ engine: null });

export function useCli(): CliContextValue {
    return useContext(CliContext);
}

import {
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
    ICliServiceProvider,
    ICliStateStore,
} from '@qodalis/cli-core';
import { CliStateStore } from './cli-state-store';

export interface ICliStateStoreManager {
    getProcessorStateStore(processor: ICliCommandProcessor): ICliStateStore;
    getStateStore(
        name: string,
        defaultState?: Record<string, any>,
    ): ICliStateStore;
    getStoreEntries(): { name: string; state: Record<string, any> }[];
}

export class CliStateStoreManager implements ICliStateStoreManager {
    private stores = new Map<string, ICliStateStore>();

    constructor(
        private readonly services: ICliServiceProvider,
        private readonly registry: ICliCommandProcessorRegistry,
    ) {}

    public getStateStore(
        name: string,
        defaultState?: Record<string, any>,
    ): ICliStateStore {
        if (!this.stores.has(name)) {
            this.stores.set(
                name,
                new CliStateStore(this.services, name, defaultState ?? {}),
            );
        }
        return this.stores.get(name)!;
    }

    public getProcessorStateStore(
        processor: ICliCommandProcessor,
    ): ICliStateStore {
        const rootProcessor = this.registry.getRootProcessor(processor);
        return this.getStateStore(
            rootProcessor.stateConfiguration?.storeName ||
                rootProcessor.command,
            rootProcessor.stateConfiguration?.initialState,
        );
    }

    /**
     * Returns all store names and their current state values.
     */
    getStoreEntries(): { name: string; state: Record<string, any> }[] {
        const entries: { name: string; state: Record<string, any> }[] = [];
        this.stores.forEach((store, name) => {
            entries.push({ name, state: store.getState() });
        });
        return entries;
    }
}

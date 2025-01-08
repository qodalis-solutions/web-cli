import {
    ICliCommandProcessor,
    ICliContextServices,
    ICliStateStore,
} from '@qodalis/cli-core';
import { CliStateStore } from './cli-state-store';

export class CliStateStoreManager {
    private stores = new Map<string, ICliStateStore>();

    constructor(private readonly services: ICliContextServices) {}

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
        return this.getStateStore(
            processor.metadata?.storeName || processor.command,
        );
    }
}

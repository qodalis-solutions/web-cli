import {
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
    ICliServiceProvider,
    ICliStateStore,
} from '@qodalis/cli-core';
import { CliStateStore } from './cli-state-store';
import { Inject, Injectable } from '@angular/core';
import {
    CliProcessorsRegistry_TOKEN,
    CliServiceProvider_TOKEN,
} from '../tokens';

@Injectable()
export class CliStateStoreManager {
    private stores = new Map<string, ICliStateStore>();

    constructor(
        @Inject(CliServiceProvider_TOKEN)
        private readonly services: ICliServiceProvider,
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
        const registry = this.services.get<ICliCommandProcessorRegistry>(
            CliProcessorsRegistry_TOKEN,
        );

        const rootProcessor = registry.getRootProcessor(processor);

        return this.getStateStore(
            rootProcessor.stateConfiguration?.storeName ||
                rootProcessor.command,
            rootProcessor.stateConfiguration?.initialState,
        );
    }
}

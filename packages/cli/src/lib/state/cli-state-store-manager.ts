import {
    CliState,
    CliStateStoreOptions,
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
    ICliServiceProvider,
    ICliStateStore,
    ICliEventBus,
} from '@qodalis/cli-core';
import { CliStateStore } from './cli-state-store';

export interface ICliStateStoreManager {
    getProcessorStateStore(processor: ICliCommandProcessor): ICliStateStore;
    getStateStore(
        name: string,
        defaultState?: Record<string, any>,
        options?: CliStateStoreOptions,
    ): ICliStateStore;
    getStoreEntries(): { name: string; state: Record<string, any> }[];
}

/** Channel the stores of all tabs and terminals share saved state on. */
export const CLI_STATE_SYNC_CHANNEL = 'qodalis-cli-state';

interface CliStateSyncMessage {
    key: string;
    state: CliState;
}

export class CliStateStoreManager implements ICliStateStoreManager {
    private stores = new Map<string, CliStateStore>();

    private channel?: BroadcastChannel;

    /** The signed-in user (for `scope: 'user'` stores). */
    private user?: string;

    private stopFollowingUser?: () => void;

    constructor(
        private readonly services: ICliServiceProvider,
        private readonly registry: ICliCommandProcessorRegistry,
    ) {}

    /**
     * Get (or create) the store `name`. Defaults and options passed for a
     * store that already exists are added to it: a store read early (e.g.
     * by the boot report) still gets its command's initial state.
     */
    public getStateStore(
        name: string,
        defaultState?: Record<string, any>,
        options?: CliStateStoreOptions,
    ): ICliStateStore {
        let store = this.stores.get(name);
        if (!store) {
            store = new CliStateStore(
                this.services,
                name,
                defaultState ?? {},
                options,
            );
            store.setUser(this.user);
            store.onPersisted = (key, state) => this.publish(key, state);
            this.stores.set(name, store);
            this.listen();
        } else {
            if (defaultState) store.applyDefaults(defaultState);
            if (options) store.setOptions(options);
        }
        return store;
    }

    public getProcessorStateStore(
        processor: ICliCommandProcessor,
    ): ICliStateStore {
        const rootProcessor = this.registry.getRootProcessor(processor);
        const config = rootProcessor.stateConfiguration;
        return this.getStateStore(
            config?.storeName || rootProcessor.command,
            config?.initialState,
            config
                ? {
                      autoPersist: config.autoPersist,
                      version: config.version,
                      migrate: config.migrate,
                      syncAcrossTabs: config.syncAcrossTabs,
                      scope: config.scope,
                  }
                : undefined,
        );
    }

    /**
     * Follow the signed-in user (`session:changed` events), so `scope: 'user'`
     * stores switch to that user's state.
     */
    followUser(events: ICliEventBus): void {
        this.stopFollowingUser?.();
        this.stopFollowingUser = events.on('session:changed', (event) =>
            this.setUser(event.data.user),
        );
    }

    /** Switch `scope: 'user'` stores to `user`'s saved state. */
    setUser(user: string | undefined): void {
        if (user === this.user) return;
        this.user = user;
        for (const store of this.stores.values()) {
            store.setUser(user);
        }
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

    /**
     * Dispose all stores (completes their BehaviorSubjects).
     * Called during engine teardown.
     */
    dispose(): void {
        this.stopFollowingUser?.();
        this.stopFollowingUser = undefined;
        this.stores.forEach((store) => store.dispose());
        this.stores.clear();
        this.channel?.close();
        this.channel = undefined;
    }

    /** Tell other tabs and terminals that a store was saved. */
    private publish(key: string, state: CliState): void {
        const store = [...this.stores.values()].find((s) => s.key === key);
        if (!this.channel || !store?.syncAcrossTabs) return;
        try {
            this.channel.postMessage({ key, state } as CliStateSyncMessage);
        } catch {
            // State that cannot be cloned is still saved, just not shared
        }
    }

    private listen(): void {
        if (this.channel || typeof BroadcastChannel === 'undefined') return;
        try {
            this.channel = new BroadcastChannel(CLI_STATE_SYNC_CHANNEL);
        } catch {
            return;
        }
        this.channel.onmessage = (event: MessageEvent<CliStateSyncMessage>) => {
            const { key, state } = event.data ?? ({} as CliStateSyncMessage);
            if (!key || !state || typeof state !== 'object') return;
            for (const store of this.stores.values()) {
                if (store.key === key && store.syncAcrossTabs) {
                    void store.refreshFromStorage(state);
                }
            }
        };
    }
}

import {
    ICliKeyValueStore,
    ICliServiceProvider,
    CliProvider,
} from '@qodalis/cli-core';
import { CliStateStore } from '../lib/state/cli-state-store';
import { CliStateStoreManager } from '../lib/state/cli-state-store-manager';
import { CliCommandProcessorRegistry } from '../lib/registry';
import { ICliCommandProcessor } from '@qodalis/cli-core';

// ---------------------------------------------------------------------------
// Mock key-value store
// ---------------------------------------------------------------------------
class MockKeyValueStore implements ICliKeyValueStore {
    private data = new Map<string, any>();

    async get<T = any>(key: string): Promise<T | undefined> {
        return this.data.get(key) as T | undefined;
    }
    async set(key: string, value: any): Promise<void> {
        this.data.set(key, value);
    }
    async remove(key: string): Promise<void> {
        this.data.delete(key);
    }
    async clear(): Promise<void> {
        this.data.clear();
    }
}

// ---------------------------------------------------------------------------
// Mock service provider
// ---------------------------------------------------------------------------
class MockServiceProvider implements ICliServiceProvider {
    private services = new Map<any, any>();

    get<T>(token: any): T {
        if (!this.services.has(token)) {
            throw new Error(`No provider for ${token}`);
        }
        return this.services.get(token) as T;
    }

    set(definition: CliProvider | CliProvider[]): void {
        const defs = Array.isArray(definition) ? definition : [definition];
        for (const d of defs) {
            if ('useValue' in d) {
                this.services.set(d.provide, d.useValue);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// CliStateStore
// ---------------------------------------------------------------------------
describe('CliStateStore', () => {
    let store: CliStateStore;
    let services: MockServiceProvider;
    let kvStore: MockKeyValueStore;

    beforeEach(() => {
        kvStore = new MockKeyValueStore();
        services = new MockServiceProvider();
        services.set({ provide: 'cli-key-value-store', useValue: kvStore });
        store = new CliStateStore(services, 'test-store', {
            count: 0,
            label: 'init',
        });
    });

    it('should return initial state', () => {
        expect(store.getState()).toEqual({ count: 0, label: 'init' });
    });

    it('should update state with partial merge', () => {
        store.updateState({ count: 5 });
        expect(store.getState()).toEqual({ count: 5, label: 'init' });
    });

    it('should update state multiple times', () => {
        store.updateState({ count: 1 });
        store.updateState({ label: 'updated' });
        store.updateState({ count: 2 });
        expect(store.getState()).toEqual({ count: 2, label: 'updated' });
    });

    it('should reset to initial state', () => {
        store.updateState({ count: 99, label: 'modified' });
        store.reset();
        expect(store.getState()).toEqual({ count: 0, label: 'init' });
    });

    it('should notify subscribers on state change', () => {
        const states: any[] = [];
        store.subscribe((state) => states.push({ ...state }));
        store.updateState({ count: 1 });
        store.updateState({ count: 2 });

        // BehaviorSubject emits current value on subscribe + 2 updates
        expect(states.length).toBe(3);
        expect(states[0]).toEqual({ count: 0, label: 'init' });
        expect(states[1]).toEqual({ count: 1, label: 'init' });
        expect(states[2]).toEqual({ count: 2, label: 'init' });
    });

    it('should select a slice of state', (done) => {
        const values: number[] = [];
        store
            .select((s) => s['count'])
            .subscribe((count) => {
                values.push(count);
                if (values.length === 3) {
                    // 0 (initial), 1, 5  — deduplication via distinctUntilChanged
                    expect(values).toEqual([0, 1, 5]);
                    done();
                }
            });
        store.updateState({ count: 1 });
        store.updateState({ count: 1 }); // Same value, should not emit
        store.updateState({ count: 5 });
    });

    it('should persist state to key-value store', async () => {
        store.updateState({ count: 42 });
        await store.persist();
        const persisted = await kvStore.get('store-state-test-store');
        expect(persisted).toEqual({ count: 42, label: 'init' });
    });

    it('should initialize from persisted state', async () => {
        await kvStore.set('store-state-test-store', {
            count: 99,
            label: 'persisted',
        });
        await store.initialize();
        expect(store.getState()).toEqual({ count: 99, label: 'persisted' });
    });

    it('should keep initial state when no persisted data exists', async () => {
        await store.initialize();
        expect(store.getState()).toEqual({ count: 0, label: 'init' });
    });

    it('should expose store name', () => {
        expect(store.name).toBe('test-store');
    });
});

// ---------------------------------------------------------------------------
// CliStateStoreManager
// ---------------------------------------------------------------------------
describe('CliStateStoreManager', () => {
    let manager: CliStateStoreManager;
    let services: MockServiceProvider;
    let registry: CliCommandProcessorRegistry;

    const createProcessor = (
        command: string,
        stateConfig?: any,
    ): ICliCommandProcessor => ({
        command,
        description: `Test ${command}`,
        stateConfiguration: stateConfig,
        async processCommand() {},
    });

    beforeEach(() => {
        const kvStore = new MockKeyValueStore();
        services = new MockServiceProvider();
        services.set({ provide: 'cli-key-value-store', useValue: kvStore });
        registry = new CliCommandProcessorRegistry();
        manager = new CliStateStoreManager(services, registry);
    });

    it('should create and return a state store by name', () => {
        const store = manager.getStateStore('myStore', { x: 1 });
        expect(store).toBeDefined();
        expect(store.getState()).toEqual({ x: 1 });
    });

    it('should return the same store for the same name', () => {
        const store1 = manager.getStateStore('myStore', { x: 1 });
        const store2 = manager.getStateStore('myStore', { x: 999 });
        expect(store1).toBe(store2);
        // Initial state should remain from first creation
        expect(store2.getState()).toEqual({ x: 1 });
    });

    it('should create store with empty default state', () => {
        const store = manager.getStateStore('empty');
        expect(store.getState()).toEqual({});
    });

    it('should get processor state store using command name', () => {
        const proc = createProcessor('todo');
        registry.registerProcessor(proc);
        const store = manager.getProcessorStateStore(proc);
        expect(store).toBeDefined();
    });

    it('should get processor state store using custom store name', () => {
        const proc = createProcessor('todo', {
            storeName: 'custom-store',
            initialState: { items: [] },
        });
        registry.registerProcessor(proc);
        const store = manager.getProcessorStateStore(proc);
        expect(store.getState()).toEqual({ items: [] });

        // Should be the same store when accessed by name
        const byName = manager.getStateStore('custom-store');
        expect(byName).toBe(store);
    });

    it('should list all store entries', () => {
        const store1 = manager.getStateStore('alpha', { a: 1 });
        const store2 = manager.getStateStore('beta', { b: 2 });
        store1.updateState({ a: 10 });

        const entries = manager.getStoreEntries();
        expect(entries.length).toBe(2);
        expect(entries.find((e) => e.name === 'alpha')?.state).toEqual({
            a: 10,
        });
        expect(entries.find((e) => e.name === 'beta')?.state).toEqual({ b: 2 });
    });

    it('should return empty entries when no stores exist', () => {
        expect(manager.getStoreEntries()).toEqual([]);
    });
});

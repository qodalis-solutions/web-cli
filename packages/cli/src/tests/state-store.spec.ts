import {
    ICliKeyValueStore,
    ICliServiceProvider,
    CliProvider,
} from '@qodalis/cli-core';
import { CliStateStore } from '../lib/state/cli-state-store';
import { CliStateStoreManager } from '../lib/state/cli-state-store-manager';
import { CliCommandProcessorRegistry } from '../lib/registry';
import { ICliCommandProcessor } from '@qodalis/cli-core';
import { CliKeyValueStore_TOKEN } from '../lib/tokens';

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

    get<T>(token: any): T | undefined {
        return this.services.get(token) as T | undefined;
    }

    getAll<T>(token: any): T[] {
        const val = this.services.get(token);
        return val !== undefined ? (Array.isArray(val) ? val : [val]) : [];
    }

    getRequired<T>(token: any): T {
        if (!this.services.has(token)) {
            throw new Error(`No provider for ${token}`);
        }
        return this.services.get(token) as T;
    }

    has(token: any): boolean {
        return this.services.has(token);
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
        services.set({ provide: CliKeyValueStore_TOKEN, useValue: kvStore });
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

    it('should complete BehaviorSubject on dispose', () => {
        let completed = false;
        store.subscribe({
            complete: () => (completed = true),
        } as any);

        store.dispose();

        expect(completed).toBe(true);
    });

    it('should not emit new values after dispose', () => {
        const values: any[] = [];
        store.subscribe((state) => values.push({ ...state }));

        // Initial emission from BehaviorSubject
        expect(values.length).toBe(1);

        store.dispose();

        // After dispose, updateState calls next() on a completed subject —
        // RxJS silently ignores it, so no new emission should occur
        store.updateState({ count: 999 });
        expect(values.length).toBe(1);
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
        services.set({ provide: CliKeyValueStore_TOKEN, useValue: kvStore });
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

    it('should dispose all stores and clear the map', () => {
        const store1 = manager.getStateStore('alpha', { a: 1 });
        const store2 = manager.getStateStore('beta', { b: 2 });

        manager.dispose();

        // After dispose, getStoreEntries should be empty (map was cleared)
        expect(manager.getStoreEntries()).toEqual([]);

        // Stores should be completed — subscribing after dispose should
        // complete immediately (BehaviorSubject is completed)
        let completed = false;
        (store1 as CliStateStore)
            .select((s) => s)
            .subscribe({ complete: () => (completed = true) });
        expect(completed).toBe(true);

        let completed2 = false;
        (store2 as CliStateStore)
            .select((s) => s)
            .subscribe({ complete: () => (completed2 = true) });
        expect(completed2).toBe(true);
    });

    it('should allow creating new stores after dispose', () => {
        manager.getStateStore('old', { x: 1 });
        manager.dispose();

        const newStore = manager.getStateStore('new', { y: 2 });
        expect(newStore.getState()).toEqual({ y: 2 });
        expect(manager.getStoreEntries().length).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// Loading, saving, migration and sync
// ---------------------------------------------------------------------------
describe('CliStateStore persistence', () => {
    let kvStore: MockKeyValueStore;
    let services: MockServiceProvider;

    // Saves run under a cross-tab lock: give them a few ticks
    const flush = () => new Promise<void>((r) => setTimeout(r, 20));

    beforeEach(() => {
        kvStore = new MockKeyValueStore();
        services = new MockServiceProvider();
        services.set({ provide: CliKeyValueStore_TOKEN, useValue: kvStore });
    });

    it('returns a copy from getState', () => {
        const store = new CliStateStore(services, 's', { a: 1 });
        const state = store.getState();
        state['a'] = 2;
        expect(store.getState()).toEqual({ a: 1 });
    });

    it('merges saved state over the initial state (keys added later are kept)', async () => {
        await kvStore.set('store-state-s', { a: 5 });
        const store = new CliStateStore(services, 's', { a: 1, added: [] });
        await store.initialize();
        expect(store.getState()).toEqual({ a: 5, added: [] });
    });

    it('loads once: a later initialize keeps changes made since', async () => {
        await kvStore.set('store-state-s', { a: 5 });
        const store = new CliStateStore(services, 's', { a: 1 });
        await store.initialize();
        store.updateState({ a: 6 });
        await store.initialize();
        expect(store.getState()).toEqual({ a: 6 });
    });

    it('reload reads the saved state again', async () => {
        const store = new CliStateStore(services, 's', { a: 1 });
        await store.initialize();
        await kvStore.set('store-state-s', { a: 9 });
        await store.reload();
        expect(store.getState()).toEqual({ a: 9 });
    });

    it('keeps keys changed before the saved state was loaded', async () => {
        await kvStore.set('store-state-s', { a: 5, b: 5 });
        const store = new CliStateStore(services, 's', { a: 1, b: 1 });
        store.updateState({ b: 2 });
        await store.initialize();
        expect(store.getState()).toEqual({ a: 5, b: 2 });
    });

    it('never replaces saved data when saving before loading', async () => {
        await kvStore.set('store-state-snippets', {
            snippets: { old: 'echo old' },
        });
        const store = new CliStateStore(services, 'snippets', {
            snippets: {},
        });
        // what `snippet save` did after a reload
        const { snippets } = store.getState();
        store.updateState({ snippets: { ...snippets, added: 'echo new' } });
        await store.persist();

        const saved = await kvStore.get('store-state-snippets');
        expect(saved.snippets.added).toBe('echo new');
    });

    it('persist does nothing without a key-value store', async () => {
        const store = new CliStateStore(new MockServiceProvider(), 's', {});
        store.updateState({ a: 1 });
        await expectAsync(store.persist()).toBeResolved();
        await expectAsync(store.initialize()).toBeResolved();
    });

    it('autoPersist saves once after the changes of a tick', async () => {
        const store = new CliStateStore(
            services,
            's',
            { a: 0 },
            { autoPersist: true },
        );
        const setSpy = spyOn(kvStore, 'set').and.callThrough();
        store.updateState({ a: 1 });
        store.updateState({ a: 2 });
        await flush();
        expect(setSpy).toHaveBeenCalledTimes(1);
        expect(await kvStore.get('store-state-s')).toEqual({ a: 2 });

        store.reset();
        await flush();
        expect(await kvStore.get('store-state-s')).toEqual({ a: 0 });
    });

    it('does not save automatically without autoPersist', async () => {
        const store = new CliStateStore(services, 's', { a: 0 });
        store.updateState({ a: 1 });
        await flush();
        expect(await kvStore.get('store-state-s')).toBeUndefined();
    });

    it('migrates saved state of an older version and saves it', async () => {
        await kvStore.set('store-state-todo', { items: ['a', 'b'] }); // v0
        const migrate = jasmine
            .createSpy('migrate')
            .and.callFake((state: any) => ({
                todos: state.items.map((text: string) => ({ text })),
            }));
        const store = new CliStateStore(
            services,
            'todo',
            { todos: [] },
            { version: 1, migrate },
        );
        await store.initialize();

        expect(migrate).toHaveBeenCalledWith({ items: ['a', 'b'] }, 0);
        expect(store.getState()['todos']).toEqual([
            { text: 'a' },
            { text: 'b' },
        ]);
        expect(await kvStore.get('store-state-todo:version')).toBe(1);

        // Already migrated: not again
        const again = new CliStateStore(
            services,
            'todo',
            { todos: [] },
            { version: 1, migrate },
        );
        await again.initialize();
        expect(migrate).toHaveBeenCalledTimes(1);
    });

    it('saves the version with the state', async () => {
        const store = new CliStateStore(services, 's', {}, { version: 3 });
        store.updateState({ a: 1 });
        await store.persist();
        expect(await kvStore.get('store-state-s:version')).toBe(3);
    });

    describe('manager', () => {
        let managers: CliStateStoreManager[];
        const registry = new CliCommandProcessorRegistry();
        const createManager = () => {
            const m = new CliStateStoreManager(services, registry);
            managers.push(m);
            return m;
        };

        beforeEach(() => (managers = []));
        afterEach(() => managers.forEach((m) => m.dispose()));

        it('adds defaults to a store first created without them', () => {
            const manager = createManager();
            const early = manager.getStateStore('configure');
            early.updateState({ system: { a: 1 } });

            const store = manager.getStateStore('configure', {
                system: {},
                plugins: {},
            });
            expect(store).toBe(early);
            expect(store.getState()).toEqual({
                system: { a: 1 },
                plugins: {},
            });
            store.reset();
            expect(store.getState()).toEqual({ system: {}, plugins: {} });
        });

        it('passes the processor state options to its store', async () => {
            const manager = createManager();
            const store = manager.getProcessorStateStore({
                command: 'auto',
                description: '',
                stateConfiguration: {
                    initialState: { n: 0 },
                    autoPersist: true,
                },
                async processCommand() {},
            });
            store.updateState({ n: 1 });
            await flush();
            expect(await kvStore.get('store-state-auto')).toEqual({ n: 1 });
        });

        it('applies state saved by another tab or terminal', async () => {
            const a = createManager().getStateStore('theme', { name: 'x' });
            const b = createManager().getStateStore('theme', { name: 'x' });

            a.updateState({ name: 'dracula' });
            await a.persist();
            await new Promise((r) => setTimeout(r, 50));

            expect(b.getState()).toEqual({ name: 'dracula' });
        });

        it('does not sync stores with syncAcrossTabs: false', async () => {
            const options = { syncAcrossTabs: false };
            const a = createManager().getStateStore('game', { n: 0 }, options);
            const b = createManager().getStateStore('game', { n: 0 }, options);

            a.updateState({ n: 5 });
            await a.persist();
            await new Promise((r) => setTimeout(r, 50));

            expect(b.getState()).toEqual({ n: 0 });
        });
    });
});

describe('CliStateStore across terminals', () => {
    let kvStore: MockKeyValueStore;
    let services: MockServiceProvider;

    beforeEach(() => {
        kvStore = new MockKeyValueStore();
        services = new MockServiceProvider();
        services.set({ provide: CliKeyValueStore_TOKEN, useValue: kvStore });
    });

    it('two terminals saving different keys keep both', async () => {
        const a = new CliStateStore(services, 'shared', { x: 0, y: 0 });
        const b = new CliStateStore(services, 'shared', { x: 0, y: 0 });
        await a.initialize();
        await b.initialize();

        a.updateState({ x: 1 });
        b.updateState({ y: 2 });
        await Promise.all([a.persist(), b.persist()]);

        expect(await kvStore.get('store-state-shared')).toEqual({ x: 1, y: 2 });
        // Each also picked up the other's key when saving (the later one at least)
        const states = [a.getState(), b.getState()];
        expect(states).toContain(jasmine.objectContaining({ x: 1, y: 2 }));
    });

    it('the last save wins for the same key', async () => {
        const a = new CliStateStore(services, 'shared', { x: 0 });
        const b = new CliStateStore(services, 'shared', { x: 0 });
        await a.initialize();
        await b.initialize();
        a.updateState({ x: 1 });
        await a.persist();
        b.updateState({ x: 2 });
        await b.persist();
        expect(await kvStore.get('store-state-shared')).toEqual({ x: 2 });
    });

    it('saves a key changed in place without updateState', async () => {
        const store = new CliStateStore(services, 's', { list: [] as string[] });
        await store.initialize();
        (store.getState()['list'] as string[]).push('a'); // in place
        await store.persist();
        expect(await kvStore.get('store-state-s')).toEqual({ list: ['a'] });
    });

    it('does not write keys it did not change over newer saved values', async () => {
        const a = new CliStateStore(services, 'shared', { x: 0, y: 0 });
        await a.initialize();
        // another terminal saved y meanwhile
        await kvStore.set('store-state-shared', { x: 0, y: 7 });

        a.updateState({ x: 1 });
        await a.persist();

        expect(await kvStore.get('store-state-shared')).toEqual({ x: 1, y: 7 });
        expect(a.getState()).toEqual({ x: 1, y: 7 });
    });

    it('keeps unsaved local keys when another terminal saves', () => {
        const store = new CliStateStore(services, 's', { x: 0, y: 0 });
        store.updateState({ x: 5 });
        store.applySaved({ x: 1, y: 1 });
        expect(store.getState()).toEqual({ x: 5, y: 1 });
    });

    it('reset writes the whole state', async () => {
        await kvStore.set('store-state-s', { x: 3, extra: true });
        const store = new CliStateStore(services, 's', { x: 0 });
        await store.initialize();
        store.reset();
        await store.persist();
        expect(await kvStore.get('store-state-s')).toEqual({ x: 0 });
    });

    it('a session store is never loaded, saved or synced', async () => {
        await kvStore.set('store-state-s', { x: 9 });
        const store = new CliStateStore(
            services,
            's',
            { x: 0 },
            { scope: 'session', autoPersist: true },
        );
        await store.initialize();
        expect(store.getState()).toEqual({ x: 0 });

        store.updateState({ x: 1 });
        await store.persist();
        await new Promise((r) => setTimeout(r, 20));
        expect(await kvStore.get('store-state-s')).toEqual({ x: 9 });

        store.applySaved({ x: 4 });
        expect(store.getState()).toEqual({ x: 1 });
    });

    it('later options without a value keep earlier ones', async () => {
        const store = new CliStateStore(
            services,
            's',
            { x: 0 },
            { autoPersist: true },
        );
        store.setOptions({ autoPersist: undefined, version: undefined });
        store.updateState({ x: 1 });
        await new Promise((r) => setTimeout(r, 20));
        expect(await kvStore.get('store-state-s')).toEqual({ x: 1 });
    });
});

describe('CliStateStore defaults and sync', () => {
    it('applies another terminal\'s save to a store that got its defaults late', async () => {
        const services = new MockServiceProvider();
        services.set({
            provide: CliKeyValueStore_TOKEN,
            useValue: new MockKeyValueStore(),
        });
        // Read early (boot report) without defaults, nothing saved yet
        const store = new CliStateStore(services, 'configure', {});
        await store.initialize();
        store.applyDefaults({ system: { greeting: true }, plugins: {} });

        store.applySaved({ system: { greeting: false }, plugins: {} });
        expect(store.getState()['system']).toEqual({ greeting: false });
    });

    it('applies another terminal\'s save when nothing was saved at load', async () => {
        const services = new MockServiceProvider();
        services.set({
            provide: CliKeyValueStore_TOKEN,
            useValue: new MockKeyValueStore(),
        });
        const store = new CliStateStore(services, 's', { x: 0 });
        await store.initialize();
        store.applySaved({ x: 3 });
        expect(store.getState()).toEqual({ x: 3 });
    });
});

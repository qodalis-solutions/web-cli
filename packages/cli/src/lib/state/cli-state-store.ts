import {
    CliState,
    CliStateStoreOptions,
    ICliServiceProvider,
    ICliKeyValueStore,
    ICliStateStore,
} from '@qodalis/cli-core';
import { CliKeyValueStore_TOKEN } from '../tokens';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

export class CliStateStore implements ICliStateStore {
    private state$: BehaviorSubject<CliState>;

    /** Signed-in user, for `scope: 'user'` stores. */
    private user?: string;

    private initialState: CliState;

    private options: CliStateStoreOptions;

    /** The first load from storage (see `initialize`). */
    private loading?: Promise<void>;

    private loaded = false;

    /** Keys changed before the saved state was loaded: they win over it. */
    private readonly changedBeforeLoad = new Set<string>();

    /** Keys changed since the last save (only these are written). */
    private readonly unsaved = new Set<string>();

    /** `reset()` since the last save: the whole state is written. */
    private replaceOnSave = false;

    /**
     * Each key as last loaded, saved or received (JSON), to also find keys
     * changed in place without `updateState`.
     */
    private baseline = new Map<string, string>();

    private persistScheduled = false;

    /**
     * Called after the state was saved (set by the store manager to share it
     * with other tabs).
     */
    onPersisted?: (storageKey: string, state: CliState) => void;

    constructor(
        private readonly services: ICliServiceProvider,
        public readonly name: string,
        initialState: CliState,
        options?: CliStateStoreOptions,
    ) {
        this.initialState = { ...initialState };
        this.options = {};
        if (options) this.setOptions(options);
        this.state$ = new BehaviorSubject<CliState>({ ...initialState });
        this.setBaseline(initialState);

    }

    /** Key the state is saved under. */
    get key(): string {
        return this.storageKey;
    }

    /**
     * Saved per store, or per signed-in user for `scope: 'user'` (signed
     * out, the state is shared like a global store).
     */
    private get storageKey(): string {
        const base = `store-state-${this.name}`;
        return this.options.scope === 'user' && this.user
            ? `${base}:user:${this.user}`
            : base;
    }

    /**
     * The signed-in user changed: a `scope: 'user'` store switches to that
     * user's saved state (unsaved changes of the previous user are dropped,
     * so save before switching users).
     */
    setUser(user: string | undefined): void {
        if (user === this.user) return;
        const before = this.storageKey;
        this.user = user;
        if (this.options.scope !== 'user' || this.storageKey === before) return;

        this.unsaved.clear();
        this.changedBeforeLoad.clear();
        this.replaceOnSave = false;
        this.setBaseline(this.initialState);
        this.state$.next({ ...this.initialState });
        const wasLoading = !!this.loading;
        this.loaded = false;
        this.loading = undefined;
        // Loaded already for the previous user: load the new user's state now
        if (wasLoading) void this.initialize();
    }

    /** Whether changes saved by other tabs are applied to this store. */
    get syncAcrossTabs(): boolean {
        return this.options.syncAcrossTabs !== false && !this.isSession;
    }

    /** A session store lives in this terminal only and is never saved. */
    private get isSession(): boolean {
        return this.options.scope === 'session';
    }

    getState<T extends CliState = CliState>(): T {
        return { ...this.state$.getValue() } as T;
    }

    updateState(newState: Partial<CliState>): void {
        for (const key of Object.keys(newState)) {
            if (!this.loaded) this.changedBeforeLoad.add(key);
            this.unsaved.add(key);
        }
        this.state$.next({ ...this.state$.getValue(), ...newState });
        this.schedulePersist();
    }

    select<K>(selector: (state: CliState) => K): Observable<K> {
        return this.state$.asObservable().pipe(
            map(selector),
            distinctUntilChanged(), // Emit only when the selected value changes
        );
    }

    subscribe(callback: (state: CliState) => void): Subscription {
        return this.state$.asObservable().subscribe(callback);
    }

    reset(): void {
        this.replaceOnSave = true;
        this.unsaved.clear();
        this.state$.next({ ...this.initialState });
        this.schedulePersist();
    }

    /**
     * Save the state. The saved state is loaded first, so saving before the
     * store was loaded never replaces data with the initial state.
     */
    async persist(): Promise<void> {
        await this.initialize();
        await this.write();
    }

    /**
     * Change the state from its latest saved value and save it, atomically:
     * under the cross-tab lock, `change` gets the state as saved (plus this
     * terminal's unsaved changes) and its result is merged and written. Two
     * terminals updating the same key never lose each other's change, e.g.
     * both adding an item to a list. Without storage (or for a session
     * store) it is a plain `updateState`.
     */
    async update(change: (state: CliState) => Partial<CliState>): Promise<void> {
        await this.initialize();
        const keyValueStore = this.services.get<ICliKeyValueStore>(
            CliKeyValueStore_TOKEN,
        );
        if (!keyValueStore || this.isSession) {
            this.updateState(change(this.getState()));
            return;
        }
        await this.write(change);
    }

    initialize(): Promise<void> {
        if (!this.loading) {
            this.loading = this.load();
        }
        return this.loading;
    }

    async reload(): Promise<void> {
        await this.loading?.catch(() => undefined);
        this.loaded = false;
        this.changedBeforeLoad.clear();
        this.loading = this.load();
        return this.loading;
    }

    /**
     * Add defaults for keys the store does not have yet (when it was first
     * created without them, e.g. read before its command registered).
     */
    applyDefaults(defaults: CliState): void {
        this.initialState = { ...defaults, ...this.initialState };
        const current = this.state$.getValue();
        const missing = Object.keys(defaults).filter((key) => !(key in current));
        if (missing.length === 0) return;
        // Defaults are not changes made here: other terminals' saves apply
        for (const key of missing) {
            if (!this.baseline.has(key)) {
                this.baseline.set(key, toJson(defaults[key]));
            }
        }
        this.state$.next({ ...defaults, ...current });
    }

    /** Merge store options (later options win). */
    setOptions(options: CliStateStoreOptions): void {
        const defined = Object.entries(options).filter(
            ([, value]) => value !== undefined,
        );
        this.options = { ...this.options, ...Object.fromEntries(defined) };
    }

    /**
     * State saved by another tab or terminal: apply it without saving again,
     * keeping the keys changed here and not saved yet.
     */
    applySaved(state: CliState): void {
        if (this.isSession) return;
        const current = this.state$.getValue();
        const local = this.pick(current, this.changedKeys());
        this.setBaseline({ ...this.initialState, ...state });
        this.state$.next({ ...this.initialState, ...state, ...local });
    }

    /**
     * Complete the BehaviorSubject so all subscribers are notified
     * and no further emissions occur. Called during engine teardown.
     */
    dispose(): void {
        this.onPersisted = undefined;
        this.state$.complete();
    }

    private async load(): Promise<void> {
        const keyValueStore = this.services.get<ICliKeyValueStore>(
            CliKeyValueStore_TOKEN,
        );
        if (!keyValueStore || this.isSession) {
            this.loaded = true;
            return;
        }

        try {
            let saved = await keyValueStore.get<CliState>(this.storageKey);
            let migrated = false;

            const { version, migrate } = this.options;
            if (saved && version !== undefined && migrate) {
                const savedVersion =
                    (await keyValueStore.get<number>(this.versionKey)) ?? 0;
                if (savedVersion < version) {
                    saved = migrate(saved, savedVersion);
                    migrated = true;
                }
            }

            if (!saved || typeof saved !== 'object') {
                // Nothing saved yet: the initial state is what "saved" means
                this.setBaseline(this.initialState);
            } else {
                const loaded = { ...this.initialState, ...saved };
                this.setBaseline(loaded);
                this.state$.next({
                    ...loaded,
                    ...this.pick(
                        this.state$.getValue(),
                        this.changedBeforeLoad,
                    ),
                });
            }
            this.loaded = true;
            this.changedBeforeLoad.clear();

            if (migrated) {
                // The saved shape changed: write the whole migrated state
                this.replaceOnSave = true;
                await this.write();
            }
        } catch (e) {
            this.loaded = true;
            console.error(
                `CliStateStore: Failed to load state for "${this.name}":`,
                e,
            );
        }
    }

    /**
     * Save the keys changed here, merged into the saved state (the whole
     * state after `reset()` or a migration). Runs under a lock shared by all
     * tabs, so two terminals saving at once do not lose each other's keys.
     * Keys others saved meanwhile are applied here.
     */
    private async write(
        mutate?: (state: CliState) => Partial<CliState>,
    ): Promise<void> {
        const keyValueStore = this.services.get<ICliKeyValueStore>(
            CliKeyValueStore_TOKEN,
        );
        if (!keyValueStore || this.isSession) {
            return;
        }

        const saved = await withLock(`qodalis-cli:${this.storageKey}`, async () => {
            const replace = this.replaceOnSave;
            const keys = this.changedKeys();
            const current = this.state$.getValue();

            // Keys changed here win; for the others, what is saved is newer
            // (another terminal may have saved them since)
            let next: CliState = current;
            if (!replace) {
                const stored = await keyValueStore.get<CliState>(
                    this.storageKey,
                );
                if (stored && typeof stored === 'object') {
                    next = {
                        ...current,
                        ...stored,
                        ...this.pick(current, keys),
                    };
                }
            }
            // update(): the change is computed from the latest saved state
            if (mutate) {
                next = { ...next, ...mutate({ ...next }) };
            }
            await keyValueStore.set(this.storageKey, next);
            if (this.options.version !== undefined) {
                await keyValueStore.set(this.versionKey, this.options.version);
            }

            // Written: take the keys others saved, keep changes made while
            // saving (they stay unsaved)
            if (replace) this.replaceOnSave = false;
            const latest = this.state$.getValue();
            const changedMeanwhile = Object.keys(latest).filter(
                (key) => latest[key] !== current[key],
            );
            for (const key of keys) {
                if (!changedMeanwhile.includes(key)) this.unsaved.delete(key);
            }
            this.setBaseline(next);
            this.state$.next({
                ...this.initialState,
                ...next,
                ...this.pick(latest, changedMeanwhile),
            });
            return next;
        });

        this.onPersisted?.(this.storageKey, saved);
    }

    /** Keys changed here since the last load, save or received state. */
    private changedKeys(): Set<string> {
        const keys = new Set(this.unsaved);
        const current = this.state$.getValue();
        for (const key of Object.keys(current)) {
            if (toJson(current[key]) !== this.baseline.get(key)) {
                keys.add(key);
            }
        }
        return keys;
    }

    private setBaseline(state: CliState): void {
        this.baseline = new Map(
            Object.keys(state).map((key) => [key, toJson(state[key])]),
        );
    }

    private pick(state: CliState, keys: Iterable<string>): CliState {
        const picked: CliState = {};
        for (const key of keys) {
            if (key in state) picked[key] = state[key];
        }
        return picked;
    }

    private get versionKey(): string {
        return `${this.storageKey}:version`;
    }

    /** With `autoPersist`, save once after the changes of this tick. */
    private schedulePersist(): void {
        if (!this.options.autoPersist || this.persistScheduled) return;
        this.persistScheduled = true;
        queueMicrotask(() => {
            this.persistScheduled = false;
            this.persist().catch((e) =>
                console.error(
                    `CliStateStore: Failed to save state for "${this.name}":`,
                    e,
                ),
            );
        });
    }
}

/**
 * Run `task` under a lock shared by every tab of the browser (Web Locks
 * API); without it, just run it.
 */
async function withLock<T>(name: string, task: () => Promise<T>): Promise<T> {
    const locks = (globalThis.navigator as Navigator | undefined)?.locks;
    if (!locks?.request) {
        return task();
    }
    return locks.request(name, task) as Promise<T>;
}

let uncomparable = 0;

/** JSON of a value; a value that cannot be serialized never compares equal. */
function toJson(value: unknown): string {
    try {
        return JSON.stringify(value) ?? 'undefined';
    } catch {
        return `\u0000${++uncomparable}`;
    }
}

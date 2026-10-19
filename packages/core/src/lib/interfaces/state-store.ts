import { Observable, Subscription } from 'rxjs';
import { CliState } from '../models';

/**
 * Represents a key-value store for the CLI
 */
export interface ICliKeyValueStore {
    /**
     * Retrieves a value by key.
     * @param key - The key to retrieve the value for.
     * @returns A promise resolving to the value or undefined if not found.
     */
    get<T = any>(key: string): Promise<T | undefined>;

    /**
     * Sets a key-value pair in the store.
     * @param key - The key to set.
     * @param value - The value to store.
     * @returns A promise resolving when the value is stored.
     */
    set(key: string, value: any): Promise<void>;

    /**
     * Removes a key-value pair by key.
     * @param key - The key to remove.
     * @returns A promise resolving when the key is removed.
     */
    remove(key: string): Promise<void>;

    /**
     * Clears all key-value pairs from the store.
     * @returns A promise resolving when the store is cleared.
     */
    clear(): Promise<void>;
}

/**
 * Reactive state store scoped to a command processor or module.
 *
 * State is a plain object (`Record<string, any>`). Updates are shallow-merged
 * (top-level keys are replaced, nested objects are not deep-merged).
 * `getState()` returns a shallow copy: assigning its top-level keys has no
 * effect, and nested objects must not be mutated in place either; always use
 * `updateState()` to change state.
 *
 * Saved state is loaded once, before the store's command first runs (or by
 * `initialize()`), and merged over the initial state, so keys added to the
 * initial state later are present. Changes are saved with `persist()`, or
 * after every change with `autoPersist`.
 *
 * A store is global by default: one saved state shared by every terminal and
 * tab of the browser. A save writes only the top-level keys this terminal
 * changed (merged into what is saved, under a cross-tab lock), so terminals
 * changing different keys never overwrite each other; for the same key the
 * last save wins. Changes saved elsewhere are applied here, except keys
 * changed here and not saved yet. A store with `scope: 'session'` belongs to
 * one terminal and is never saved.
 */
export interface ICliStateStore {
    /**
     * Get a snapshot of the current state.
     * @returns A shallow copy of the state object
     */
    getState<T extends CliState = CliState>(): T;

    /**
     * Shallow-merge new values into the current state.
     * Only the provided keys are updated; other keys are preserved.
     * Triggers subscribers and persists if a storage backend is configured.
     * @param newState Partial state to merge with the current state
     */
    updateState(newState: Partial<CliState>): void;

    /**
     * Change the state from its latest saved value and save it, atomically
     * (under a lock shared by all tabs): use it for read-modify-write changes
     * such as adding an item to a list, so terminals changing the same key at
     * once never lose each other's change.
     *
     * ```ts
     * await context.state.update((s) => ({ todos: [...s.todos, todo] }));
     * ```
     */
    update(change: (state: CliState) => Partial<CliState>): Promise<void>;

    /**
     * Select a specific property or computed value from the state.
     * @param selector A function to project a slice of the state.
     * @returns Observable of the selected value.
     */
    select<K>(selector: (state: CliState) => K): Observable<K>;

    /**
     * Subscribe to state changes.
     * @param callback Callback function to handle state changes.
     * @returns Subscription object to manage the subscription.
     */
    subscribe(callback: (state: CliState) => void): Subscription;

    /**
     * Reset the state to its initial value.
     */
    reset(): void;

    /**
     * Persist the state to storage (does nothing when no storage is available).
     */
    persist(): Promise<void>;

    /**
     * Load the saved state, once: later calls resolve when that first load
     * is done and keep changes made since.
     */
    initialize(): Promise<void>;

    /** Read the saved state again, replacing the current state. */
    reload?(): Promise<void>;
}

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
 * `getState()` returns a snapshot — mutating the returned object has no effect;
 * always use `updateState()` to change state.
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
     * Persist the state to storage.
     */
    persist(): Promise<void>;

    /**
     * Initialize the state from storage.
     */
    initialize(): Promise<void>;
}

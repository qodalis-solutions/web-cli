import { Injectable } from '@angular/core';
import { ICliKeyValueStore } from '@qodalis/cli-core';

@Injectable({
    providedIn: 'root',
})
export class CliKeyValueStore implements ICliKeyValueStore {
    private dbName = 'CliKeyValueDB';
    private storeName = 'KeyValueStore';
    private db!: IDBDatabase;

    constructor() {}

    /**
     * Initializes the IndexedDB instance.
     */
    public initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };

            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve();
            };

            request.onerror = (event) => {
                console.error('Error initializing IndexedDB:', event);
                reject();
            };
        });
    }

    /**
     * Retrieves a value by key.
     * @param key - The key to retrieve the value for.
     * @returns A promise resolving to the value or undefined if not found.
     */
    async get<T = any>(key: string): Promise<T | undefined> {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(
                    this.storeName,
                    'readonly',
                );
                const store = transaction.objectStore(this.storeName);
                const request = store.get(key);

                request.onsuccess = () => {
                    resolve(request.result as T);
                };

                request.onerror = (event) => {
                    console.error('Error getting value:', event);
                    reject(undefined);
                };
            } catch (e) {
                console.error('Error getting value:', e);
                reject(undefined);
            }
        });
    }

    /**
     * Sets a key-value pair in the store.
     * @param key - The key to set.
     * @param value - The value to store.
     * @returns A promise resolving when the value is stored.
     */
    async set(key: string, value: any): Promise<void> {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
                this.storeName,
                'readwrite',
            );
            const store = transaction.objectStore(this.storeName);
            const request = store.put(value, key);

            request.onsuccess = () => resolve();

            request.onerror = (event) => {
                console.error('Error setting value:', event);
                reject();
            };
        });
    }

    /**
     * Removes a key-value pair by key.
     * @param key - The key to remove.
     * @returns A promise resolving when the key is removed.
     */
    async remove(key: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
                this.storeName,
                'readwrite',
            );
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();

            request.onerror = (event) => {
                console.error('Error removing value:', event);
                reject();
            };
        });
    }

    /**
     * Clears all key-value pairs from the store.
     * @returns A promise resolving when the store is cleared.
     */
    async clear(): Promise<void> {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
                this.storeName,
                'readwrite',
            );
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();

            request.onerror = (event) => {
                console.error('Error clearing store:', event);
                reject();
            };
        });
    }
}

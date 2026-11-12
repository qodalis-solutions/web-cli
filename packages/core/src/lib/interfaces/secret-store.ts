import { createCliToken } from '../models/services';

/**
 * Where the CLI keeps secrets such as the API tokens of servers linked with
 * `server add`. The default encrypts them with a non-extractable Web Crypto key
 * kept in IndexedDB; a host replaces it (Android Keystore, iOS Keychain,
 * Electron `safeStorage`) by providing {@link ICliSecretStore_TOKEN}.
 */
export interface ICliSecretStore {
    /** Whether secrets can be kept (e.g. false without Web Crypto on an insecure page). */
    isAvailable(): boolean | Promise<boolean>;
    /** The secret saved under `key`, or undefined. */
    get(key: string): Promise<string | undefined>;
    /** Saves a secret under `key`, replacing any previous one. */
    set(key: string, value: string): Promise<void>;
    /** Deletes the secret saved under `key`. */
    delete(key: string): Promise<void>;
    /** Deletes every secret (and the key that encrypts them). */
    clear(): Promise<void>;
}

/** Token for {@link ICliSecretStore} */
export const ICliSecretStore_TOKEN = createCliToken<ICliSecretStore>('cli-secret-store');

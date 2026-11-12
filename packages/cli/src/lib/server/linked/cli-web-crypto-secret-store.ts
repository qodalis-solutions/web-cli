import { ICliKeyValueStore, ICliSecretStore } from '@qodalis/cli-core';

/** The AES-GCM key (non-extractable `CryptoKey`, kept by IndexedDB's structured clone). */
const KEY_KEY = 'qcli-secret-key';
/** Names of the saved secrets, so `clear()` finds them. */
const NAMES_KEY = 'qcli-secret-names';
const SECRET_PREFIX = 'qcli-secret:';

interface EncryptedSecret {
    iv: Uint8Array;
    data: Uint8Array;
}

/**
 * The default {@link ICliSecretStore}: each secret encrypted with AES-GCM (own
 * random IV) by a 256-bit key that Web Crypto never exports, both kept in the
 * key-value store (IndexedDB). Reading the database gives ciphertext only; the
 * key cannot be read out, only used by this origin.
 */
export class CliWebCryptoSecretStore implements ICliSecretStore {
    private keyPromise: Promise<CryptoKey> | null = null;

    constructor(
        private readonly kv: ICliKeyValueStore,
        /** Null: no Web Crypto (an insecure page). */
        private readonly crypto: Crypto | null = globalThis.crypto ?? null,
    ) {}

    isAvailable(): boolean {
        return !!this.crypto?.subtle && typeof this.crypto.getRandomValues === 'function';
    }

    async get(key: string): Promise<string | undefined> {
        if (!this.isAvailable()) return undefined;
        const record = await this.kv.get<EncryptedSecret>(SECRET_PREFIX + key);
        if (!record?.iv || !record?.data) return undefined;
        const cryptoKey = await this.kv.get<CryptoKey>(KEY_KEY);
        if (!cryptoKey) return undefined;
        try {
            const plain = await this.crypto!.subtle.decrypt(
                { name: 'AES-GCM', iv: record.iv as BufferSource },
                cryptoKey,
                record.data as BufferSource,
            );
            return new TextDecoder().decode(plain);
        } catch {
            // Another key (storage partly cleared) or tampered data
            return undefined;
        }
    }

    async set(key: string, value: string): Promise<void> {
        if (!this.isAvailable()) {
            throw new Error('Secrets cannot be saved: this page has no Web Crypto (it must be served over https)');
        }
        const cryptoKey = await this.key();
        const iv = this.crypto!.getRandomValues(new Uint8Array(12));
        const data = await this.crypto!.subtle.encrypt(
            { name: 'AES-GCM', iv },
            cryptoKey,
            new TextEncoder().encode(value),
        );
        await this.kv.set(SECRET_PREFIX + key, { iv, data: new Uint8Array(data) } satisfies EncryptedSecret);
        const names = (await this.kv.get<string[]>(NAMES_KEY)) ?? [];
        if (!names.includes(key)) await this.kv.set(NAMES_KEY, [...names, key]);
    }

    async delete(key: string): Promise<void> {
        await this.kv.remove(SECRET_PREFIX + key);
        const names = (await this.kv.get<string[]>(NAMES_KEY)) ?? [];
        if (names.includes(key)) await this.kv.set(NAMES_KEY, names.filter((n) => n !== key));
    }

    async clear(): Promise<void> {
        for (const name of (await this.kv.get<string[]>(NAMES_KEY)) ?? []) {
            await this.kv.remove(SECRET_PREFIX + name);
        }
        await this.kv.remove(NAMES_KEY);
        await this.kv.remove(KEY_KEY);
        this.keyPromise = null;
    }

    /** The saved key, or a new one (created once, even for parallel calls). */
    private key(): Promise<CryptoKey> {
        this.keyPromise ??= (async () => {
            const saved = await this.kv.get<CryptoKey>(KEY_KEY);
            if (saved) return saved;
            const created = await this.crypto!.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt'],
            );
            await this.kv.set(KEY_KEY, created);
            return created;
        })();
        const pending = this.keyPromise;
        pending.catch(() => {
            if (this.keyPromise === pending) this.keyPromise = null;
        });
        return pending;
    }
}

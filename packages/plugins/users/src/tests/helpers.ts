import { ICliKeyValueStore } from '@qodalis/cli-core';
import { CliLocalUsersBackend, CliLocalUsersBackendOptions } from '../lib/backend/local-users-backend';

export class MemoryKv implements ICliKeyValueStore {
    readonly data = new Map<string, any>();
    async get<T>(key: string): Promise<T | undefined> {
        const v = this.data.get(key);
        return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
    }
    async set(key: string, value: any): Promise<void> {
        this.data.set(key, JSON.parse(JSON.stringify(value)));
    }
    async remove(key: string): Promise<void> {
        this.data.delete(key);
    }
    async clear(): Promise<void> {
        this.data.clear();
    }
}

/** Local backend with fast hashing and a seeded root admin. Returns root's token. */
export async function localBackend(
    options: CliLocalUsersBackendOptions = {},
    kv = new MemoryKv(),
): Promise<{ backend: CliLocalUsersBackend; kv: MemoryKv; root: string }> {
    const backend = new CliLocalUsersBackend(kv, { hashIterations: 1000, ...options });
    await backend.initialize();
    if (!backend.findUserPublic('root')) {
        await backend.createUserInternal({ name: 'root', email: 'root@localhost', groups: ['admin'], password: 'root' });
    }
    const { token } = await backend.login('root', 'root');
    return { backend, kv, root: token };
}

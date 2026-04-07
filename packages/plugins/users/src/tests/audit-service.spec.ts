import { CliDefaultAuditService } from '../lib/services/cli-default-audit.service';
import { ICliKeyValueStore } from '@qodalis/cli-core';

class MockKeyValueStore implements ICliKeyValueStore {
    private store = new Map<string, any>();

    async get<T>(key: string): Promise<T | undefined> {
        return this.store.get(key) as T;
    }

    async set(key: string, value: any): Promise<void> {
        this.store.set(key, value);
    }

    async remove(key: string): Promise<void> {
        this.store.delete(key);
    }

    async clear(): Promise<void> {
        this.store.clear();
    }
}

describe('CliDefaultAuditService', () => {
    let service: CliDefaultAuditService;
    let kvStore: MockKeyValueStore;

    beforeEach(async () => {
        kvStore = new MockKeyValueStore();
        service = new CliDefaultAuditService();
        await service.initialize(kvStore);
    });

    // ---------- log ----------

    describe('log', () => {
        it('should add a timestamped entry', async () => {
            await service.log({
                event: 'login',
                username: 'alice',
            });

            const entries = await service.getEntries();
            expect(entries.length).toBe(1);
            expect(entries[0].event).toBe('login');
            expect(entries[0].username).toBe('alice');
            expect(entries[0].timestamp).toBeGreaterThan(0);
        });

        it('should include details when provided', async () => {
            await service.log({
                event: 'login_failed',
                username: 'bob',
                details: 'Wrong password',
            });

            const entries = await service.getEntries();
            expect(entries[0].details).toBe('Wrong password');
        });

        it('should persist entries to kvStore', async () => {
            await service.log({ event: 'login', username: 'alice' });

            const stored = await kvStore.get<any[]>('cli-audit-log');
            expect(stored).toBeDefined();
            expect(stored!.length).toBe(1);
        });

        it('should cap entries at 500 (FIFO)', async () => {
            for (let i = 0; i < 510; i++) {
                await service.log({
                    event: 'login',
                    username: `user-${i}`,
                });
            }

            const entries = await service.getEntries({ limit: 1000 });
            expect(entries.length).toBe(500);

            // Oldest entries should be dropped (user-0 through user-9)
            expect(entries.find(e => e.username === 'user-0')).toBeUndefined();
            // Newest should remain
            expect(entries.find(e => e.username === 'user-509')).toBeDefined();
        });
    });

    // ---------- getEntries ----------

    describe('getEntries', () => {
        beforeEach(async () => {
            await service.log({ event: 'login', username: 'alice' });
            await service.log({ event: 'logout', username: 'alice' });
            await service.log({ event: 'login', username: 'bob' });
            await service.log({ event: 'login_failed', username: 'charlie' });
            await service.log({ event: 'password_changed', username: 'alice' });
        });

        it('should return entries in reverse chronological order', async () => {
            const entries = await service.getEntries();
            expect(entries[0].event).toBe('password_changed');
            expect(entries[entries.length - 1].event).toBe('login');
        });

        it('should filter by event type', async () => {
            const entries = await service.getEntries({ event: 'login' });
            expect(entries.length).toBe(2);
            entries.forEach(e => expect(e.event).toBe('login'));
        });

        it('should filter by username', async () => {
            const entries = await service.getEntries({ username: 'alice' });
            expect(entries.length).toBe(3);
            entries.forEach(e => expect(e.username).toBe('alice'));
        });

        it('should filter by both event and username', async () => {
            const entries = await service.getEntries({
                event: 'login',
                username: 'alice',
            });
            expect(entries.length).toBe(1);
        });

        it('should limit results', async () => {
            const entries = await service.getEntries({ limit: 2 });
            expect(entries.length).toBe(2);
        });

        it('should return empty array when no entries match', async () => {
            const entries = await service.getEntries({ username: 'nobody' });
            expect(entries.length).toBe(0);
        });
    });

    // ---------- clear ----------

    describe('clear', () => {
        it('should remove all entries', async () => {
            await service.log({ event: 'login', username: 'alice' });
            await service.log({ event: 'logout', username: 'alice' });

            await service.clear();

            const entries = await service.getEntries();
            expect(entries.length).toBe(0);
        });

        it('should persist the empty state', async () => {
            await service.log({ event: 'login', username: 'alice' });
            await service.clear();

            const stored = await kvStore.get<any[]>('cli-audit-log');
            expect(stored).toEqual([]);
        });
    });

    // ---------- initialize (restore) ----------

    describe('initialize (restore)', () => {
        it('should restore entries from kvStore', async () => {
            await service.log({ event: 'login', username: 'alice' });
            await service.log({ event: 'logout', username: 'alice' });

            // Create a fresh service and initialize with the same store
            const service2 = new CliDefaultAuditService();
            await service2.initialize(kvStore);

            const entries = await service2.getEntries();
            expect(entries.length).toBe(2);
        });

        it('should handle empty kvStore', async () => {
            const freshStore = new MockKeyValueStore();
            const freshService = new CliDefaultAuditService();
            await freshService.initialize(freshStore);

            const entries = await freshService.getEntries();
            expect(entries.length).toBe(0);
        });
    });
});

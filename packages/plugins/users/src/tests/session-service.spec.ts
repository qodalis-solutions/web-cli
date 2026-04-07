import { CliDefaultUserSessionService } from '../lib/services/cli-default-user-session.service';
import { ICliKeyValueStore, ICliUserSession } from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';

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

function createMockSession(name: string = 'root'): ICliUserSession {
    return {
        user: {
            id: name,
            name,
            email: `${name}@localhost`,
            groups: ['admin'],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
        loginTime: Date.now(),
        lastActivity: Date.now(),
    };
}

describe('CliDefaultUserSessionService', () => {
    let service: CliDefaultUserSessionService;
    let kvStore: MockKeyValueStore;

    beforeEach(() => {
        service = new CliDefaultUserSessionService();
        kvStore = new MockKeyValueStore();
    });

    // ---------- initialize ----------

    describe('initialize', () => {
        it('should set up kvStore reference', async () => {
            await service.initialize(kvStore);
            // After initialize, operations like setUserSession should work without error
            const session = createMockSession();
            await expectAsync(service.setUserSession(session)).toBeResolved();
        });
    });

    // ---------- getUserSession ----------

    describe('getUserSession', () => {
        beforeEach(async () => {
            await service.initialize(kvStore);
        });

        it('should initially return undefined', async () => {
            const session = await firstValueFrom(service.getUserSession());
            expect(session).toBeUndefined();
        });
    });

    // ---------- setUserSession ----------

    describe('setUserSession', () => {
        beforeEach(async () => {
            await service.initialize(kvStore);
        });

        it('should update the observable', async () => {
            const session = createMockSession();
            await service.setUserSession(session);

            const current = await firstValueFrom(service.getUserSession());
            expect(current).toBeDefined();
            expect(current!.user.name).toBe('root');
        });

        it('should persist to kvStore', async () => {
            const session = createMockSession();
            await service.setUserSession(session);

            const stored = await kvStore.get<ICliUserSession>('cli-session');
            expect(stored).toBeDefined();
            expect(stored!.user.name).toBe('root');
        });
    });

    // ---------- clearSession ----------

    describe('clearSession', () => {
        beforeEach(async () => {
            await service.initialize(kvStore);
        });

        it('should set session to undefined', async () => {
            const session = createMockSession();
            await service.setUserSession(session);

            await service.clearSession();

            const current = await firstValueFrom(service.getUserSession());
            expect(current).toBeUndefined();
        });

        it('should remove from kvStore', async () => {
            const session = createMockSession();
            await service.setUserSession(session);

            await service.clearSession();

            const stored = await kvStore.get<ICliUserSession>('cli-session');
            expect(stored).toBeUndefined();
        });
    });

    // ---------- restoreSession ----------

    describe('restoreSession', () => {
        beforeEach(async () => {
            await service.initialize(kvStore);
        });

        it('should load session from kvStore', async () => {
            const session = createMockSession('alice');
            await kvStore.set('cli-session', session);

            const restored = await service.restoreSession();
            expect(restored).toBeDefined();
            expect(restored!.user.name).toBe('alice');

            // Also check that the observable was updated
            const current = await firstValueFrom(service.getUserSession());
            expect(current).toBeDefined();
            expect(current!.user.name).toBe('alice');
        });

        it('should return undefined when nothing stored', async () => {
            const restored = await service.restoreSession();
            expect(restored).toBeUndefined();
        });
    });

    // ---------- isExpired ----------

    describe('isExpired', () => {
        beforeEach(async () => {
            await service.initialize(kvStore);
        });

        it('should return false when no session is set', () => {
            expect(service.isExpired(60000)).toBe(false);
        });

        it('should return false when timeoutMs is 0', async () => {
            await service.setUserSession(createMockSession());
            expect(service.isExpired(0)).toBe(false);
        });

        it('should return false when timeoutMs is negative', async () => {
            await service.setUserSession(createMockSession());
            expect(service.isExpired(-1)).toBe(false);
        });

        it('should return false for a fresh session', async () => {
            await service.setUserSession(createMockSession());
            expect(service.isExpired(60000)).toBe(false);
        });

        it('should return true when session has expired', async () => {
            const session = createMockSession();
            // Set lastActivity far in the past
            session.lastActivity = Date.now() - 120000;
            await service.setUserSession(session);

            expect(service.isExpired(60000)).toBe(true);
        });

        it('should return false when session is within timeout window', async () => {
            const session = createMockSession();
            session.lastActivity = Date.now() - 30000; // 30s ago
            await service.setUserSession(session);

            expect(service.isExpired(60000)).toBe(false); // 60s timeout
        });
    });

    // ---------- persistSession ----------

    describe('persistSession', () => {
        beforeEach(async () => {
            await service.initialize(kvStore);
        });

        it('should save the current session to kvStore', async () => {
            const session = createMockSession();
            await service.setUserSession(session);

            // Clear kvStore directly to prove persistSession writes again
            await kvStore.remove('cli-session');
            expect(await kvStore.get('cli-session')).toBeUndefined();

            await service.persistSession();

            const stored = await kvStore.get<ICliUserSession>('cli-session');
            expect(stored).toBeDefined();
            expect(stored!.user.name).toBe('root');
        });

        it('should do nothing if no session is set', async () => {
            await service.persistSession();

            const stored = await kvStore.get<ICliUserSession>('cli-session');
            expect(stored).toBeUndefined();
        });
    });
});

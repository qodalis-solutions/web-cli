import { CliDefaultAuthService } from '../lib/services/cli-default-auth.service';
import { CliDefaultUsersStoreService } from '../lib/services/cli-default-users-store.service';
import { CliDefaultUserSessionService } from '../lib/services/cli-default-user-session.service';
import { ICliKeyValueStore } from '@qodalis/cli-core';
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

describe('CliDefaultAuthService', () => {
    let authService: CliDefaultAuthService;
    let usersStore: CliDefaultUsersStoreService;
    let sessionService: CliDefaultUserSessionService;
    let kvStore: MockKeyValueStore;

    beforeEach(async () => {
        kvStore = new MockKeyValueStore();
        usersStore = new CliDefaultUsersStoreService();
        sessionService = new CliDefaultUserSessionService();

        await usersStore.initialize(kvStore);
        await sessionService.initialize(kvStore);

        authService = new CliDefaultAuthService();
    });

    // ---------- initialize ----------

    describe('initialize', () => {
        it('should not seed any credentials when store is empty', async () => {
            await authService.initialize(kvStore, usersStore, sessionService);

            // No users exist, so no credentials should be seeded
            const valid = await authService.verifyPassword('root', 'root');
            expect(valid).toBe(false);
        });

        it('should not overwrite existing credentials', async () => {
            await authService.initialize(kvStore, usersStore, sessionService);

            // Create a user and set password
            const user = await usersStore.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });
            await authService.setPassword(user.id, 'mypass');

            // Re-init the service (simulates restart)
            const authService2 = new CliDefaultAuthService();
            await authService2.initialize(kvStore, usersStore, sessionService);

            const valid = await authService2.verifyPassword(user.id, 'mypass');
            expect(valid).toBe(true);
        });
    });

    // ---------- hashPassword ----------

    describe('hashPassword', () => {
        beforeEach(async () => {
            await authService.initialize(kvStore, usersStore, sessionService);
        });

        it('should produce consistent hash for same input', async () => {
            const hash1 = await authService.hashPassword(
                'mypassword',
                'salt123',
            );
            const hash2 = await authService.hashPassword(
                'mypassword',
                'salt123',
            );
            expect(hash1).toBe(hash2);
        });

        it('should produce different hash for different salt', async () => {
            const hash1 = await authService.hashPassword('mypassword', 'salt1');
            const hash2 = await authService.hashPassword('mypassword', 'salt2');
            expect(hash1).not.toBe(hash2);
        });

        it('should produce different hash for different password', async () => {
            const hash1 = await authService.hashPassword(
                'password1',
                'samesalt',
            );
            const hash2 = await authService.hashPassword(
                'password2',
                'samesalt',
            );
            expect(hash1).not.toBe(hash2);
        });

        it('should produce a hex string', async () => {
            const hash = await authService.hashPassword('test', 'salt');
            expect(hash).toMatch(/^[0-9a-f]+$/);
            // SHA-256 produces 64 hex characters
            expect(hash.length).toBe(64);
        });
    });

    // ---------- setPassword / verifyPassword ----------

    describe('setPassword and verifyPassword', () => {
        beforeEach(async () => {
            await authService.initialize(kvStore, usersStore, sessionService);
        });

        it('should store credentials and verify correct password', async () => {
            const user = await usersStore.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });

            await authService.setPassword(user.id, 'secret');
            const valid = await authService.verifyPassword(user.id, 'secret');
            expect(valid).toBe(true);
        });

        it('should return false for wrong password', async () => {
            const user = await usersStore.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });

            await authService.setPassword(user.id, 'secret');
            const valid = await authService.verifyPassword(user.id, 'wrong');
            expect(valid).toBe(false);
        });

        it('should return false for unknown user', async () => {
            const valid = await authService.verifyPassword(
                'nonexistent',
                'anything',
            );
            expect(valid).toBe(false);
        });

        it('should update password when called again', async () => {
            const user = await usersStore.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });

            await authService.setPassword(user.id, 'oldpass');
            await authService.setPassword(user.id, 'newpass');

            expect(await authService.verifyPassword(user.id, 'oldpass')).toBe(
                false,
            );
            expect(await authService.verifyPassword(user.id, 'newpass')).toBe(
                true,
            );
        });

        it('should persist credentials to kvStore', async () => {
            const user = await usersStore.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });

            await authService.setPassword(user.id, 'secret');

            const stored = await kvStore.get<any[]>('cli-credentials');
            expect(stored).toBeDefined();
            expect(stored!.some((c) => c.userId === user.id)).toBe(true);
        });
    });

    // ---------- login ----------

    describe('login', () => {
        beforeEach(async () => {
            await authService.initialize(kvStore, usersStore, sessionService);
        });

        it('should return session for valid credentials', async () => {
            const user = await usersStore.createUser({
                name: 'testuser',
                email: 'test@test.com',
                groups: [],
            });
            await authService.setPassword(user.id, 'pass');

            const session = await authService.login('testuser', 'pass');
            expect(session).toBeDefined();
            expect(session.user.name).toBe('testuser');
            expect(session.loginTime).toBeDefined();
            expect(session.lastActivity).toBeDefined();
        });

        it('should set the session on the session service after login', async () => {
            const user = await usersStore.createUser({
                name: 'testuser',
                email: 'test@test.com',
                groups: [],
            });
            await authService.setPassword(user.id, 'pass');
            await authService.login('testuser', 'pass');

            const current = await firstValueFrom(
                sessionService.getUserSession(),
            );
            expect(current).toBeDefined();
            expect(current!.user.name).toBe('testuser');
        });

        it('should throw for unknown user', async () => {
            await expectAsync(
                authService.login('nobody', 'pass'),
            ).toBeRejectedWithError(/Authentication failure/);
        });

        it('should throw for wrong password', async () => {
            const user = await usersStore.createUser({
                name: 'testuser2',
                email: 'test2@test.com',
                groups: [],
            });
            await authService.setPassword(user.id, 'correctpass');

            await expectAsync(
                authService.login('testuser2', 'wrongpassword'),
            ).toBeRejectedWithError(/Authentication failure/);
        });

        it('should throw for disabled user', async () => {
            const user = await usersStore.createUser({
                name: 'disabled-user',
                email: 'disabled@test.com',
                groups: [],
                disabled: true,
            });
            await authService.setPassword(user.id, 'pass');

            await expectAsync(
                authService.login('disabled-user', 'pass'),
            ).toBeRejectedWithError(/Account is disabled/);
        });
    });

    // ---------- logout ----------

    describe('logout', () => {
        beforeEach(async () => {
            await authService.initialize(kvStore, usersStore, sessionService);
        });

        it('should fall back to admin session after logout', async () => {
            // Create an admin user
            const admin = await usersStore.createUser({
                name: 'admin',
                email: 'admin@test.com',
                groups: ['admin'],
            });
            await authService.setPassword(admin.id, 'adminpass');

            // Create and login as a non-admin user
            const user = await usersStore.createUser({
                name: 'testlogout',
                email: 'tl@test.com',
                groups: [],
            });
            await authService.setPassword(user.id, 'pass');
            await authService.login('testlogout', 'pass');

            let current = await firstValueFrom(sessionService.getUserSession());
            expect(current?.user.name).toBe('testlogout');

            await authService.logout();

            current = await firstValueFrom(sessionService.getUserSession());
            expect(current).toBeDefined();
            expect(current?.user.name).toBe('admin');
        });
    });
});

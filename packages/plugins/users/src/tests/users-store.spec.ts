import { CliDefaultUsersStoreService } from '../lib/services/cli-default-users-store.service';
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

describe('CliDefaultUsersStoreService', () => {
    let service: CliDefaultUsersStoreService;
    let kvStore: MockKeyValueStore;

    beforeEach(() => {
        service = new CliDefaultUsersStoreService();
        kvStore = new MockKeyValueStore();
    });

    // ---------- initialize ----------

    describe('initialize', () => {
        it('should start with empty users when store is empty', async () => {
            await service.initialize(kvStore);

            const users = await firstValueFrom(service.getUsers());
            expect(users.length).toBe(0);
        });

        it('should load existing users from store', async () => {
            const existing = [
                {
                    id: 'u1',
                    name: 'alice',
                    email: 'alice@test.com',
                    groups: ['dev'],
                    createdAt: 1000,
                    updatedAt: 1000,
                },
                {
                    id: 'u2',
                    name: 'bob',
                    email: 'bob@test.com',
                    groups: [],
                    createdAt: 2000,
                    updatedAt: 2000,
                },
            ];
            await kvStore.set('cli-users', existing);

            await service.initialize(kvStore);

            const users = await firstValueFrom(service.getUsers());
            expect(users.length).toBe(2);
            expect(users[0].name).toBe('alice');
            expect(users[1].name).toBe('bob');
        });
    });

    // ---------- createUser ----------

    describe('createUser', () => {
        beforeEach(async () => {
            await service.initialize(kvStore);
        });

        it('should create a user with generated id and timestamps', async () => {
            const before = Date.now();
            const user = await service.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: ['dev'],
            });

            expect(user.id).toBeDefined();
            expect(user.id.length).toBeGreaterThan(0);
            expect(user.name).toBe('alice');
            expect(user.email).toBe('alice@test.com');
            expect(user.groups).toEqual(['dev']);
            expect(user.createdAt).toBeGreaterThanOrEqual(before);
            expect(user.updatedAt).toBeGreaterThanOrEqual(before);
        });

        it('should reject duplicate name', async () => {
            await service.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });

            await expectAsync(
                service.createUser({
                    name: 'alice',
                    email: 'different@test.com',
                    groups: [],
                }),
            ).toBeRejectedWithError(/already exists/);
        });

        it('should reject duplicate email', async () => {
            await service.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });

            await expectAsync(
                service.createUser({
                    name: 'bob',
                    email: 'alice@test.com',
                    groups: [],
                }),
            ).toBeRejectedWithError(/already exists/);
        });
    });

    // ---------- getUser ----------

    describe('getUser', () => {
        beforeEach(async () => {
            await service.initialize(kvStore);
        });

        it('should find user by id', async () => {
            const created = await service.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });

            const found = await firstValueFrom(service.getUser(created.id));
            expect(found).toBeDefined();
            expect(found!.name).toBe('alice');
        });

        it('should find user by name', async () => {
            await service.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });

            const found = await firstValueFrom(service.getUser('alice'));
            expect(found).toBeDefined();
            expect(found!.email).toBe('alice@test.com');
        });

        it('should find user by email', async () => {
            await service.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });

            const found = await firstValueFrom(
                service.getUser('alice@test.com'),
            );
            expect(found).toBeDefined();
            expect(found!.name).toBe('alice');
        });

        it('should return undefined for unknown user', async () => {
            const found = await firstValueFrom(service.getUser('nonexistent'));
            expect(found).toBeUndefined();
        });
    });

    // ---------- getUsers ----------

    describe('getUsers', () => {
        beforeEach(async () => {
            await service.initialize(kvStore);
            // add users
            await service.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: ['dev'],
            });
            await service.createUser({
                name: 'bob',
                email: 'bob@test.com',
                groups: ['admin'],
            });
            await service.createUser({
                name: 'charlie',
                email: 'charlie@test.com',
                groups: [],
            });
        });

        it('should return all users', async () => {
            const users = await firstValueFrom(service.getUsers());
            expect(users.length).toBe(3); // alice + bob + charlie
        });

        it('should filter by query matching name', async () => {
            const users = await firstValueFrom(
                service.getUsers({ query: 'ali' }),
            );
            expect(users.length).toBe(1);
            expect(users[0].name).toBe('alice');
        });

        it('should filter by query matching email', async () => {
            const users = await firstValueFrom(
                service.getUsers({ query: 'bob@test' }),
            );
            expect(users.length).toBe(1);
            expect(users[0].name).toBe('bob');
        });

        it('should support skip', async () => {
            const users = await firstValueFrom(service.getUsers({ skip: 2 }));
            expect(users.length).toBe(1); // skips alice and bob
        });

        it('should support take', async () => {
            const users = await firstValueFrom(service.getUsers({ take: 2 }));
            expect(users.length).toBe(2);
        });

        it('should support skip and take together', async () => {
            const users = await firstValueFrom(
                service.getUsers({ skip: 1, take: 2 }),
            );
            expect(users.length).toBe(2);
            expect(users[0].name).toBe('bob');
            expect(users[1].name).toBe('charlie');
        });
    });

    // ---------- updateUser ----------

    describe('updateUser', () => {
        beforeEach(async () => {
            await service.initialize(kvStore);
        });

        it('should update email', async () => {
            const created = await service.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });

            const updated = await service.updateUser(created.id, {
                email: 'alice-new@test.com',
            });

            expect(updated.email).toBe('alice-new@test.com');
            expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
        });

        it('should update groups', async () => {
            const created = await service.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });

            const updated = await service.updateUser(created.id, {
                groups: ['admin', 'dev'],
            });

            expect(updated.groups).toEqual(['admin', 'dev']);
        });

        it('should reject duplicate name', async () => {
            await service.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });
            const bob = await service.createUser({
                name: 'bob',
                email: 'bob@test.com',
                groups: [],
            });

            await expectAsync(
                service.updateUser(bob.id, { name: 'alice' }),
            ).toBeRejectedWithError(/already taken/);
        });

        it('should reject duplicate email', async () => {
            await service.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });
            const bob = await service.createUser({
                name: 'bob',
                email: 'bob@test.com',
                groups: [],
            });

            await expectAsync(
                service.updateUser(bob.id, { email: 'alice@test.com' }),
            ).toBeRejectedWithError(/already taken/);
        });

        it('should throw for unknown user', async () => {
            await expectAsync(
                service.updateUser('nonexistent', { email: 'x@y.com' }),
            ).toBeRejectedWithError(/does not exist/);
        });
    });

    // ---------- deleteUser ----------

    describe('deleteUser', () => {
        beforeEach(async () => {
            await service.initialize(kvStore);
        });

        it('should remove user', async () => {
            const created = await service.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });

            await service.deleteUser(created.id);

            const found = await firstValueFrom(service.getUser(created.id));
            expect(found).toBeUndefined();
        });

        it('should throw for unknown user', async () => {
            await expectAsync(
                service.deleteUser('nonexistent'),
            ).toBeRejectedWithError(/does not exist/);
        });
    });

    // ---------- Persistence ----------

    describe('persistence', () => {
        beforeEach(async () => {
            await service.initialize(kvStore);
        });

        it('should persist to kvStore after createUser', async () => {
            await service.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });

            const stored = await kvStore.get<any[]>('cli-users');
            expect(stored).toBeDefined();
            expect(stored!.length).toBe(1); // alice only
            expect(stored!.some((u) => u.name === 'alice')).toBe(true);
        });

        it('should persist to kvStore after updateUser', async () => {
            const created = await service.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });

            await service.updateUser(created.id, { email: 'updated@test.com' });

            const stored = await kvStore.get<any[]>('cli-users');
            expect(stored!.some((u) => u.email === 'updated@test.com')).toBe(
                true,
            );
        });

        it('should persist to kvStore after deleteUser', async () => {
            const created = await service.createUser({
                name: 'alice',
                email: 'alice@test.com',
                groups: [],
            });

            await service.deleteUser(created.id);

            const stored = await kvStore.get<any[]>('cli-users');
            expect(stored!.length).toBe(0);
        });
    });
});

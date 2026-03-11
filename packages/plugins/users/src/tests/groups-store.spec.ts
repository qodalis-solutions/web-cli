import { CliDefaultGroupsStoreService } from '../lib/services/cli-default-groups-store.service';
import {
    ICliKeyValueStore,
    ICliUsersStoreService,
    ICliUser,
} from '@qodalis/cli-core';
import { BehaviorSubject, Observable, map } from 'rxjs';
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

class MockUsersStore implements ICliUsersStoreService {
    users$ = new BehaviorSubject<ICliUser[]>([]);

    getUsers(): Observable<ICliUser[]> {
        return this.users$.asObservable();
    }

    getUser(id: string): Observable<ICliUser | undefined> {
        return this.users$.pipe(
            map((users) => users.find((u) => u.id === id || u.name === id)),
        );
    }

    async createUser(user: any): Promise<ICliUser> {
        return user;
    }

    async updateUser(): Promise<ICliUser> {
        return {} as any;
    }

    async deleteUser(): Promise<void> {}
}

describe('CliDefaultGroupsStoreService', () => {
    let service: CliDefaultGroupsStoreService;
    let kvStore: MockKeyValueStore;
    let usersStore: MockUsersStore;

    beforeEach(() => {
        service = new CliDefaultGroupsStoreService();
        kvStore = new MockKeyValueStore();
        usersStore = new MockUsersStore();
    });

    // ---------- initialize ----------

    describe('initialize', () => {
        it('should seed admin group when store is empty', async () => {
            await service.initialize(kvStore, usersStore);

            const groups = await firstValueFrom(service.getGroups());
            expect(groups.length).toBe(1);
            expect(groups[0].name).toBe('admin');
            expect(groups[0].id).toBe('admin');
            expect(groups[0].description).toBe('System administrators');
        });

        it('should load existing groups from store', async () => {
            const existing = [
                {
                    id: 'admin',
                    name: 'admin',
                    description: 'Admins',
                    createdAt: 1000,
                },
                {
                    id: 'dev',
                    name: 'dev',
                    description: 'Developers',
                    createdAt: 2000,
                },
            ];
            await kvStore.set('cli-groups', existing);

            await service.initialize(kvStore, usersStore);

            const groups = await firstValueFrom(service.getGroups());
            expect(groups.length).toBe(2);
            expect(groups[0].name).toBe('admin');
            expect(groups[1].name).toBe('dev');
        });
    });

    // ---------- createGroup ----------

    describe('createGroup', () => {
        beforeEach(async () => {
            await service.initialize(kvStore, usersStore);
        });

        it('should create a group', async () => {
            const group = await service.createGroup('dev', 'Developers');

            expect(group.id).toBe('dev');
            expect(group.name).toBe('dev');
            expect(group.description).toBe('Developers');
            expect(group.createdAt).toBeDefined();

            const groups = await firstValueFrom(service.getGroups());
            expect(groups.length).toBe(2); // admin + dev
        });

        it('should reject duplicate name', async () => {
            await service.createGroup('dev');

            await expectAsync(service.createGroup('dev')).toBeRejectedWithError(
                /already exists/,
            );
        });
    });

    // ---------- deleteGroup ----------

    describe('deleteGroup', () => {
        beforeEach(async () => {
            await service.initialize(kvStore, usersStore);
        });

        it('should remove a group', async () => {
            await service.createGroup('dev');
            await service.deleteGroup('dev');

            const groups = await firstValueFrom(service.getGroups());
            expect(groups.length).toBe(1); // only admin remains
            expect(groups[0].name).toBe('admin');
        });

        it('should throw for unknown group', async () => {
            await expectAsync(
                service.deleteGroup('nonexistent'),
            ).toBeRejectedWithError(/does not exist/);
        });

        it('should prevent deleting admin group', async () => {
            await expectAsync(
                service.deleteGroup('admin'),
            ).toBeRejectedWithError(/cannot delete the admin group/);
        });
    });

    // ---------- getGroup ----------

    describe('getGroup', () => {
        beforeEach(async () => {
            await service.initialize(kvStore, usersStore);
        });

        it('should find group by id', async () => {
            const found = await firstValueFrom(service.getGroup('admin'));
            expect(found).toBeDefined();
            expect(found!.name).toBe('admin');
        });

        it('should find group by name', async () => {
            await service.createGroup('dev', 'Developers');
            const found = await firstValueFrom(service.getGroup('dev'));
            expect(found).toBeDefined();
            expect(found!.description).toBe('Developers');
        });

        it('should return undefined for unknown group', async () => {
            const found = await firstValueFrom(service.getGroup('nonexistent'));
            expect(found).toBeUndefined();
        });
    });

    // ---------- getGroupMembers ----------

    describe('getGroupMembers', () => {
        beforeEach(async () => {
            await service.initialize(kvStore, usersStore);
        });

        it('should return users in the group', async () => {
            usersStore.users$.next([
                {
                    id: 'u1',
                    name: 'alice',
                    email: 'alice@test.com',
                    groups: ['admin'],
                    createdAt: 1000,
                    updatedAt: 1000,
                },
                {
                    id: 'u2',
                    name: 'bob',
                    email: 'bob@test.com',
                    groups: ['dev'],
                    createdAt: 2000,
                    updatedAt: 2000,
                },
                {
                    id: 'u3',
                    name: 'charlie',
                    email: 'charlie@test.com',
                    groups: ['admin', 'dev'],
                    createdAt: 3000,
                    updatedAt: 3000,
                },
            ]);

            const adminMembers = await firstValueFrom(
                service.getGroupMembers('admin'),
            );
            expect(adminMembers.length).toBe(2);
            expect(adminMembers.map((u) => u.name).sort()).toEqual([
                'alice',
                'charlie',
            ]);

            const devMembers = await firstValueFrom(
                service.getGroupMembers('dev'),
            );
            expect(devMembers.length).toBe(2);
            expect(devMembers.map((u) => u.name).sort()).toEqual([
                'bob',
                'charlie',
            ]);
        });

        it('should return empty array for group with no members', async () => {
            usersStore.users$.next([
                {
                    id: 'u1',
                    name: 'alice',
                    email: 'alice@test.com',
                    groups: ['dev'],
                    createdAt: 1000,
                    updatedAt: 1000,
                },
            ]);

            const members = await firstValueFrom(
                service.getGroupMembers('admin'),
            );
            expect(members.length).toBe(0);
        });
    });

    // ---------- Persistence ----------

    describe('persistence', () => {
        beforeEach(async () => {
            await service.initialize(kvStore, usersStore);
        });

        it('should persist to kvStore after createGroup', async () => {
            await service.createGroup('dev');

            const stored = await kvStore.get<any[]>('cli-groups');
            expect(stored).toBeDefined();
            expect(stored!.length).toBe(2);
            expect(stored!.some((g) => g.name === 'dev')).toBe(true);
        });

        it('should persist to kvStore after deleteGroup', async () => {
            await service.createGroup('dev');
            await service.deleteGroup('dev');

            const stored = await kvStore.get<any[]>('cli-groups');
            expect(stored!.length).toBe(1);
            expect(stored!.some((g) => g.name === 'dev')).toBe(false);
        });
    });
});

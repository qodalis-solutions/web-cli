import {
    ICliGroupsStoreService,
    ICliGroup,
    ICliUser,
    ICliUsersStoreService,
    ICliKeyValueStore,
} from '@qodalis/cli-core';
import { BehaviorSubject, Observable, map } from 'rxjs';

const STORAGE_KEY = 'cli-groups';

export class CliDefaultGroupsStoreService implements ICliGroupsStoreService {
    private groupsSubject = new BehaviorSubject<ICliGroup[]>([]);
    private kvStore!: ICliKeyValueStore;
    private usersStore!: ICliUsersStoreService;

    async initialize(
        kvStore: ICliKeyValueStore,
        usersStore: ICliUsersStoreService,
    ): Promise<void> {
        this.kvStore = kvStore;
        this.usersStore = usersStore;

        const stored = await kvStore.get<ICliGroup[]>(STORAGE_KEY);
        if (stored && stored.length > 0) {
            this.groupsSubject.next(stored);
        } else {
            const adminGroup: ICliGroup = {
                id: 'admin',
                name: 'admin',
                description: 'System administrators',
                createdAt: Date.now(),
            };
            this.groupsSubject.next([adminGroup]);
            await this.persist();
        }
    }

    getGroups(): Observable<ICliGroup[]> {
        return this.groupsSubject.asObservable();
    }

    getGroup(id: string): Observable<ICliGroup | undefined> {
        return this.groupsSubject
            .asObservable()
            .pipe(
                map((groups) =>
                    groups.find((g) => g.id === id || g.name === id),
                ),
            );
    }

    async createGroup(name: string, description?: string): Promise<ICliGroup> {
        const groups = this.groupsSubject.getValue();

        if (groups.some((g) => g.name === name)) {
            throw new Error(`groupadd: group '${name}' already exists`);
        }

        const group: ICliGroup = {
            id: name,
            name,
            description,
            createdAt: Date.now(),
        };

        const updated = [...groups, group];
        this.groupsSubject.next(updated);
        await this.persist();
        return group;
    }

    async deleteGroup(id: string): Promise<void> {
        const groups = this.groupsSubject.getValue();
        const group = groups.find((g) => g.id === id || g.name === id);

        if (!group) {
            throw new Error(`groupdel: group '${id}' does not exist`);
        }

        if (group.name === 'admin') {
            throw new Error(`groupdel: cannot delete the admin group`);
        }

        const updated = groups.filter((g) => g.id !== group.id);
        this.groupsSubject.next(updated);
        await this.persist();
    }

    getGroupMembers(groupId: string): Observable<ICliUser[]> {
        return this.usersStore
            .getUsers()
            .pipe(
                map((users) => users.filter((u) => u.groups.includes(groupId))),
            );
    }

    private async persist(): Promise<void> {
        await this.kvStore.set(STORAGE_KEY, this.groupsSubject.getValue());
    }
}

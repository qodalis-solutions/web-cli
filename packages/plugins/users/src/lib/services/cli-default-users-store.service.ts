import {
    ICliUser,
    ICliUsersStoreService,
    ICliKeyValueStore,
    CliAddUser,
    CliUpdateUser,
} from '@qodalis/cli-core';
import { BehaviorSubject, map, Observable } from 'rxjs';

const STORAGE_KEY = 'cli-users';

export class CliDefaultUsersStoreService implements ICliUsersStoreService {
    private usersSubject = new BehaviorSubject<ICliUser[]>([]);
    private kvStore!: ICliKeyValueStore;

    async initialize(kvStore: ICliKeyValueStore): Promise<void> {
        this.kvStore = kvStore;

        const stored = await kvStore.get<ICliUser[]>(STORAGE_KEY);
        this.usersSubject.next(stored || []);
    }

    async createUser(user: CliAddUser): Promise<ICliUser> {
        const users = this.usersSubject.getValue();

        if (users.some((u) => u.email === user.email || u.name === user.name)) {
            throw new Error(`adduser: user '${user.name}' already exists`);
        }

        const now = Date.now();
        const newUser: ICliUser = {
            ...user,
            id: crypto.randomUUID(),
            groups: user.groups || [],
            createdAt: now,
            updatedAt: now,
        };

        const updated = [...users, newUser];
        this.usersSubject.next(updated);
        await this.persist();
        return newUser;
    }

    async updateUser(id: string, updates: CliUpdateUser): Promise<ICliUser> {
        const users = this.usersSubject.getValue();
        const index = users.findIndex(
            (u) => u.id === id || u.name === id || u.email === id,
        );

        if (index === -1) {
            throw new Error(`usermod: user '${id}' does not exist`);
        }

        if (updates.name && updates.name !== users[index].name) {
            if (users.some((u) => u.name === updates.name)) {
                throw new Error(
                    `usermod: name '${updates.name}' is already taken`,
                );
            }
        }
        if (updates.email && updates.email !== users[index].email) {
            if (users.some((u) => u.email === updates.email)) {
                throw new Error(
                    `usermod: email '${updates.email}' is already taken`,
                );
            }
        }

        const updatedUser: ICliUser = {
            ...users[index],
            ...updates,
            updatedAt: Date.now(),
        };

        const updated = [...users];
        updated[index] = updatedUser;
        this.usersSubject.next(updated);
        await this.persist();
        return updatedUser;
    }

    async deleteUser(id: string): Promise<void> {
        const users = this.usersSubject.getValue();
        const user = users.find(
            (u) => u.id === id || u.name === id || u.email === id,
        );

        if (!user) {
            throw new Error(`userdel: user '${id}' does not exist`);
        }

        const updated = users.filter((u) => u.id !== user.id);
        this.usersSubject.next(updated);
        await this.persist();
    }

    getUsers(options?: {
        query?: string;
        skip?: number;
        take?: number;
    }): Observable<ICliUser[]> {
        const { query, skip, take } = options || {};

        return this.usersSubject.asObservable().pipe(
            map((users) => {
                if (query) {
                    const q = query.toLowerCase();
                    users = users.filter(
                        (u) =>
                            u.name.toLowerCase().includes(q) ||
                            u.email.toLowerCase().includes(q),
                    );
                }
                if (skip) {
                    users = users.slice(skip);
                }
                if (take) {
                    users = users.slice(0, take);
                }
                return users;
            }),
        );
    }

    getUser(id: string): Observable<ICliUser | undefined> {
        return this.usersSubject
            .asObservable()
            .pipe(
                map((users) =>
                    users.find(
                        (u) => u.id === id || u.name === id || u.email === id,
                    ),
                ),
            );
    }

    private async persist(): Promise<void> {
        await this.kvStore.set(STORAGE_KEY, this.usersSubject.getValue());
    }
}

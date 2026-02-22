import { Injectable } from '@angular/core';
import { ICliUser, ICliUsersStoreService } from '@qodalis/cli-core';
import { BehaviorSubject, map, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class CliUsersStoreService implements ICliUsersStoreService {
    private localStorageKey = 'users';

    protected defaultUsers: ICliUser[] = [
        {
            id: 'root',
            name: 'root',
            email: 'root@domain.com',
            groups: ['admin'],
        },
    ];

    protected usersSubject = new BehaviorSubject<ICliUser[]>([]);

    constructor() {
        this.initialize(this.defaultUsers);
    }

    protected initialize(defaultUsers: ICliUser[]): void {
        const storedUsers = this.loadUsers(defaultUsers);
        this.usersSubject.next(storedUsers);
    }

    async createUser(user: Omit<ICliUser, 'id'>): Promise<ICliUser> {
        const users = this.usersSubject.getValue();

        if (users.some((u) => u.email === user.email || u.name === user.name)) {
            return Promise.reject('User already exists');
        }

        const newUser: ICliUser = {
            ...user,
            id: user.email,
        };

        users.push(newUser);
        this.saveUsers(users);
        this.usersSubject.next(users);

        return newUser;
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
                    const queryLower = query.toLowerCase();
                    users = users.filter(
                        (u) =>
                            u.name.toLowerCase().includes(queryLower) ||
                            u.email.toLowerCase().includes(queryLower),
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

    private saveUsers(users: ICliUser[]): void {
        localStorage.setItem(this.localStorageKey, JSON.stringify(users));
    }

    private loadUsers(fallbackUsers: ICliUser[]): ICliUser[] {
        const data = localStorage.getItem(this.localStorageKey);
        if (!data) {
            return fallbackUsers;
        }

        try {
            return JSON.parse(data) as ICliUser[];
        } catch (error) {
            console.error('Failed to parse user data from localStorage', error);
            return fallbackUsers;
        }
    }
}

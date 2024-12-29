import { Injectable } from '@angular/core';
import { ICliUser, ICliUsersStoreService } from '@qodalis/cli-core';
import { BehaviorSubject, map, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class CliUsersStoreService implements ICliUsersStoreService {
    protected usersSubject = new BehaviorSubject<ICliUser[]>([
        {
            id: 'root',
            name: 'root',
            email: 'root@domain.com',
        },
    ]);

    getUsers(): Observable<ICliUser[]> {
        return this.usersSubject.asObservable();
    }

    setUsers(users: ICliUser[]): Promise<void> {
        return new Promise((resolve) => {
            this.usersSubject.next(users);
            resolve();
        });
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
}

import { Injectable } from '@angular/core';
import { ICliUserSessionService, ICliUserSession } from '../models';
import { BehaviorSubject, Observable } from 'rxjs';
import { CliUsersStoreService } from './cli-users-store.service';

@Injectable({
    providedIn: 'root',
})
export class CliUserSessionService implements ICliUserSessionService {
    private userSessionSubject = new BehaviorSubject<
        ICliUserSession | undefined
    >(undefined);

    constructor(private readonly usersService: CliUsersStoreService) {
        this.usersService.getUsers().subscribe((users) => {
            const user = users.find((u) => u.id === 'guest');
            if (user) {
                this.setUserSession({
                    user,
                });
            }
        });
    }

    async setUserSession(session: ICliUserSession): Promise<void> {
        this.userSessionSubject.next(session);
    }

    getUserSession(): Observable<ICliUserSession | undefined> {
        return this.userSessionSubject.asObservable();
    }
}

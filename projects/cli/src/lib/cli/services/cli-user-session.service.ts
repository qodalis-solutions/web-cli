import { Inject, Injectable } from '@angular/core';
import {
    ICliUserSessionService,
    ICliUserSession,
    ICliUsersStoreService,
} from '@qodalis/cli-core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ICliUsersStoreService_TOKEN } from '../tokens';

@Injectable({
    providedIn: 'root',
})
export class CliUserSessionService implements ICliUserSessionService {
    private userSessionSubject = new BehaviorSubject<
        ICliUserSession | undefined
    >(undefined);

    constructor(
        @Inject(ICliUsersStoreService_TOKEN)
        private readonly usersService: ICliUsersStoreService,
    ) {
        this.usersService.getUsers().subscribe((users) => {
            const user = users.find((u) => u.id === 'root');
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

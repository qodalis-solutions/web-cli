import { Injectable } from '@angular/core';
import { CliUsersStoreService, ICliUser } from '@qodalis/angular-cli';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class CliCustomUsersStoreService extends CliUsersStoreService {
    constructor() {
        super();

        this.usersSubject = new BehaviorSubject<ICliUser[]>([
            {
                id: 'root',
                name: 'demo',
                email: 'demo@demo.com',
            },
            {
                id: 'root1',
                name: 'demo1',
                email: 'demo1@demo1.com',
            },
        ]);
    }
}

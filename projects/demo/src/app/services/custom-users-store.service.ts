import { Injectable } from '@angular/core';
import { CliUsersStoreService } from '@qodalis/angular-cli';

@Injectable()
export class CliCustomUsersStoreService extends CliUsersStoreService {
    constructor() {
        super();
    }

    protected override initialize(): void {
        super.initialize([
            {
                id: 'root',
                name: 'root',
                email: 'root@root.com',
                groups: ['admin'],
            },
            {
                id: 'root1',
                name: 'root1',
                email: 'root1@root.com',
                groups: ['admin'],
            },
        ]);
    }
}

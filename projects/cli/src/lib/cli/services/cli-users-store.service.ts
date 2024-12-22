import { Injectable } from '@angular/core';
import { ICliUser, ICliUsersStoreService } from '../models';
import { BehaviorSubject, map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CliUsersStoreService implements ICliUsersStoreService {
  private usersSubject = new BehaviorSubject<ICliUser[]>([
    {
      id: 'guest',
      name: 'guest',
      email: 'guest@guest.com',
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
      .pipe(map((users) => users.find((u) => u.id === id)));
  }
}

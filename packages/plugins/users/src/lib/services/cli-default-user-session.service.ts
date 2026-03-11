import {
    ICliUserSessionService,
    ICliUserSession,
    ICliKeyValueStore,
} from '@qodalis/cli-core';
import { BehaviorSubject, Observable } from 'rxjs';

const SESSION_KEY = 'cli-session';

export class CliDefaultUserSessionService implements ICliUserSessionService {
    private sessionSubject = new BehaviorSubject<ICliUserSession | undefined>(
        undefined,
    );
    private kvStore!: ICliKeyValueStore;

    async initialize(kvStore: ICliKeyValueStore): Promise<void> {
        this.kvStore = kvStore;
    }

    getUserSession(): Observable<ICliUserSession | undefined> {
        return this.sessionSubject.asObservable();
    }

    async setUserSession(session: ICliUserSession): Promise<void> {
        this.sessionSubject.next(session);
        await this.persistSession();
    }

    async clearSession(): Promise<void> {
        this.sessionSubject.next(undefined);
        await this.kvStore.remove(SESSION_KEY);
    }

    async persistSession(): Promise<void> {
        const session = this.sessionSubject.getValue();
        if (session) {
            await this.kvStore.set(SESSION_KEY, session);
        }
    }

    async restoreSession(): Promise<ICliUserSession | undefined> {
        const stored = await this.kvStore.get<ICliUserSession>(SESSION_KEY);
        if (stored) {
            this.sessionSubject.next(stored);
        }
        return stored;
    }
}

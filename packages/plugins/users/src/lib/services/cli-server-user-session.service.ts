import {
    ICliUserSessionService,
    ICliUserSession,
    ICliHttpClient,
    ICliKeyValueStore,
} from '@qodalis/cli-core';
import { BehaviorSubject, Observable } from 'rxjs';

const SERVER_TOKEN_KEY = 'cli-server-auth-token';

/**
 * Shape of the `GET /sessions/current` response.
 */
interface CliServerSessionResponse {
    id?: string;
    user: ICliUserSession['user'];
    loginTime: number;
    lastActivity?: number;
}

export class CliServerUserSessionService implements ICliUserSessionService {
    private session$ = new BehaviorSubject<ICliUserSession | undefined>(undefined);

    constructor(
        private readonly baseUrl: string,
        private readonly http: ICliHttpClient,
        private readonly kvStore: ICliKeyValueStore,
    ) {}

    getUserSession(): Observable<ICliUserSession | undefined> {
        return this.session$.asObservable();
    }

    /** Server-assigned id of the current session, when known */
    getSessionId(): string | undefined {
        return this.session$.getValue()?.data?.['sessionId'];
    }

    async setUserSession(session: ICliUserSession): Promise<void> {
        this.session$.next(session);
    }

    async clearSession(): Promise<void> {
        this.session$.next(undefined);
        await this.kvStore.remove(SERVER_TOKEN_KEY);
    }

    async restoreSession(): Promise<ICliUserSession | undefined> {
        const token = await this.kvStore.get<string>(SERVER_TOKEN_KEY);
        if (!token) return undefined;

        try {
            const session = await this.http.get<CliServerSessionResponse>(
                `${this.baseUrl}/sessions/current`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            const userSession: ICliUserSession = {
                user: session.user,
                loginTime: session.loginTime,
                lastActivity: session.lastActivity ?? Date.now(),
                data: session.id ? { sessionId: session.id } : undefined,
            };
            this.session$.next(userSession);
            return userSession;
        } catch {
            // Token expired or invalid
            await this.kvStore.remove(SERVER_TOKEN_KEY);
            return undefined;
        }
    }

    async persistSession(): Promise<void> {
        // No-op — server owns persistence
    }
}

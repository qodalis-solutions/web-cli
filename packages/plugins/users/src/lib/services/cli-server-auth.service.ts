import { firstValueFrom } from 'rxjs';
import {
    ICliAuthService,
    ICliUserSession,
    ICliHttpClient,
    ICliKeyValueStore,
    ICliUserSessionService,
    ICliUserEventService,
    ICliUserEvent,
    ICliUser,
} from '@qodalis/cli-core';

const SERVER_TOKEN_KEY = 'cli-server-auth-token';

/**
 * Shape of the `POST /sessions` (login) response.
 */
interface CliServerLoginResponse {
    token: string;
    session: {
        id?: string;
        user: ICliUser;
        loginTime: number;
        lastActivity?: number;
    };
}

export class CliServerAuthService implements ICliAuthService {
    private token: string | undefined;

    constructor(
        private readonly baseUrl: string,
        private readonly http: ICliHttpClient,
        private readonly kvStore: ICliKeyValueStore,
        private readonly sessionService: ICliUserSessionService,
        private readonly onTokenChange: (token: string | undefined) => void,
        private readonly eventService?: ICliUserEventService,
    ) {}

    async initialize(): Promise<void> {
        this.token = await this.kvStore.get<string>(SERVER_TOKEN_KEY);
        if (this.token) {
            this.onTokenChange(this.token);
        }
    }

    private getHeaders(): Record<string, string> {
        return this.token ? { Authorization: `Bearer ${this.token}` } : {};
    }

    /**
     * Drops the locally held token without calling the server.
     * Used when the server already invalidated the session (401 or kick).
     */
    async forgetToken(): Promise<void> {
        this.token = undefined;
        await this.kvStore.remove(SERVER_TOKEN_KEY);
        this.onTokenChange(undefined);
    }

    async login(username: string, password: string): Promise<ICliUserSession> {
        let result: CliServerLoginResponse;
        try {
            result = await this.http.post<CliServerLoginResponse>(
                `${this.baseUrl}/sessions`,
                { username, password },
                { headers: { 'Content-Type': 'application/json' } },
            );
        } catch (e: any) {
            this.emitEvent(
                'login_failed',
                { id: '', name: username, email: '', groups: [], createdAt: 0, updatedAt: 0 },
                e?.message,
            );
            throw e;
        }

        this.token = result.token;
        await this.kvStore.set(SERVER_TOKEN_KEY, this.token);
        this.onTokenChange(this.token);

        const session: ICliUserSession = {
            user: result.session.user,
            loginTime: result.session.loginTime,
            lastActivity: result.session.lastActivity ?? Date.now(),
            data: result.session.id ? { sessionId: result.session.id } : undefined,
        };

        await this.sessionService.setUserSession(session);
        this.emitEvent('login', session.user);
        return session;
    }

    async logout(): Promise<void> {
        const current = await this.currentUser();
        try {
            await this.http.delete(`${this.baseUrl}/sessions/current`, {
                headers: this.getHeaders(),
            });
        } catch {
            // Server may already have cleared session
        }
        this.token = undefined;
        await this.kvStore.remove(SERVER_TOKEN_KEY);
        this.onTokenChange(undefined);
        await this.sessionService.clearSession();
        if (current) {
            this.emitEvent('logout', current);
        }
    }

    async verifyPassword(userId: string, password: string): Promise<boolean> {
        try {
            const result = await this.http.post<{ valid: boolean }>(
                `${this.baseUrl}/users/${encodeURIComponent(userId)}/verify-password`,
                { password },
                { headers: { ...this.getHeaders(), 'Content-Type': 'application/json' } },
            );
            return result.valid;
        } catch {
            return false;
        }
    }

    async setPassword(userId: string, password: string, currentPassword?: string): Promise<void> {
        await this.http.put(
            `${this.baseUrl}/users/${encodeURIComponent(userId)}/password`,
            currentPassword !== undefined
                ? { newPassword: password, currentPassword }
                : { newPassword: password },
            { headers: { ...this.getHeaders(), 'Content-Type': 'application/json' } },
        );
        const current = await this.currentUser();
        if (current && current.id === userId) {
            this.emitEvent('password_changed', current);
        }
    }

    async hashPassword(password: string, _salt: string): Promise<string> {
        // Server handles hashing — return password as-is
        return password;
    }

    validatePassword(password: string): string | null {
        // Optional client-side pre-validation — no constraints in server mode
        return null;
    }

    private async currentUser(): Promise<ICliUser | undefined> {
        try {
            const session = await firstValueFrom(this.sessionService.getUserSession());
            return session?.user;
        } catch {
            return undefined;
        }
    }

    private emitEvent(type: ICliUserEvent['type'], user: ICliUser, details?: string): void {
        this.eventService?.emit({ type, user, timestamp: Date.now(), details });
    }
}

import {
    ICliAuthService,
    ICliUserSession,
    ICliHttpClient,
    ICliKeyValueStore,
    ICliUserSessionService,
} from '@qodalis/cli-core';

const SERVER_TOKEN_KEY = 'cli-server-auth-token';

export class CliServerAuthService implements ICliAuthService {
    private token: string | undefined;

    constructor(
        private readonly baseUrl: string,
        private readonly http: ICliHttpClient,
        private readonly kvStore: ICliKeyValueStore,
        private readonly sessionService: ICliUserSessionService,
        private readonly onTokenChange: (token: string | undefined) => void,
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

    async login(username: string, password: string): Promise<ICliUserSession> {
        const result = await this.http.post<{
            token: string;
            session: { user: any; loginTime: number };
        }>(`${this.baseUrl}/auth/login`, { username, password }, {
            headers: { 'Content-Type': 'application/json' },
        });

        this.token = result.token;
        await this.kvStore.set(SERVER_TOKEN_KEY, this.token);
        this.onTokenChange(this.token);

        const session: ICliUserSession = {
            user: result.session.user,
            loginTime: result.session.loginTime,
            lastActivity: Date.now(),
        };

        await this.sessionService.setUserSession(session);
        return session;
    }

    async logout(): Promise<void> {
        try {
            await this.http.post(`${this.baseUrl}/auth/logout`, undefined, {
                headers: this.getHeaders(),
            });
        } catch {
            // Server may already have cleared session
        }
        this.token = undefined;
        await this.kvStore.remove(SERVER_TOKEN_KEY);
        this.onTokenChange(undefined);
        await this.sessionService.clearSession();
    }

    async verifyPassword(userId: string, password: string): Promise<boolean> {
        try {
            const result = await this.http.post<{ valid: boolean }>(
                `${this.baseUrl}/auth/verify`,
                { userId, password },
                { headers: { ...this.getHeaders(), 'Content-Type': 'application/json' } },
            );
            return result.valid;
        } catch {
            return false;
        }
    }

    async setPassword(userId: string, password: string): Promise<void> {
        await this.http.put(
            `${this.baseUrl}/users/${encodeURIComponent(userId)}/password`,
            { newPassword: password },
            { headers: { ...this.getHeaders(), 'Content-Type': 'application/json' } },
        );
    }

    async hashPassword(password: string, _salt: string): Promise<string> {
        // Server handles hashing — return password as-is
        return password;
    }

    validatePassword(password: string): string | null {
        // Optional client-side pre-validation — no constraints in server mode
        return null;
    }
}

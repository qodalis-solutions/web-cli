import {
    ICliAuthService,
    ICliUserSession,
    ICliUserCredentials,
    ICliUsersStoreService,
    ICliUserSessionService,
    ICliKeyValueStore,
} from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';

const CREDENTIALS_KEY = 'cli-credentials';

export class CliDefaultAuthService implements ICliAuthService {
    private credentials: ICliUserCredentials[] = [];
    private kvStore!: ICliKeyValueStore;
    private usersStore!: ICliUsersStoreService;
    private sessionService!: ICliUserSessionService;

    async initialize(
        kvStore: ICliKeyValueStore,
        usersStore: ICliUsersStoreService,
        sessionService: ICliUserSessionService,
    ): Promise<void> {
        this.kvStore = kvStore;
        this.usersStore = usersStore;
        this.sessionService = sessionService;

        const stored =
            await kvStore.get<ICliUserCredentials[]>(CREDENTIALS_KEY);
        this.credentials = stored || [];
    }

    async login(username: string, password: string): Promise<ICliUserSession> {
        const user = await firstValueFrom(this.usersStore.getUser(username));

        if (!user) {
            throw new Error('login: Authentication failure');
        }

        if (user.disabled) {
            throw new Error('login: Account is disabled');
        }

        const valid = await this.verifyPassword(user.id, password);
        if (!valid) {
            throw new Error('login: Authentication failure');
        }

        const session: ICliUserSession = {
            user,
            loginTime: Date.now(),
            lastActivity: Date.now(),
        };

        await this.sessionService.setUserSession(session);

        return session;
    }

    async logout(): Promise<void> {
        await this.sessionService.clearSession();

        // Fall back to first admin user session
        const users = await firstValueFrom(this.usersStore.getUsers());
        const adminUser = users.find(u => u.groups.includes('admin'));
        if (adminUser) {
            await this.sessionService.setUserSession({
                user: adminUser,
                loginTime: Date.now(),
                lastActivity: Date.now(),
            });
        }
    }

    async setPassword(userId: string, password: string): Promise<void> {
        const salt = this.generateSalt();
        const passwordHash = await this.hashPassword(password, salt);

        const existing = this.credentials.findIndex((c) => c.userId === userId);
        const cred: ICliUserCredentials = {
            userId,
            passwordHash,
            salt,
            lastChanged: Date.now(),
        };

        if (existing >= 0) {
            this.credentials[existing] = cred;
        } else {
            this.credentials.push(cred);
        }

        await this.persistCredentials();
    }

    async verifyPassword(userId: string, password: string): Promise<boolean> {
        const cred = this.credentials.find((c) => c.userId === userId);
        if (!cred) {
            return false;
        }

        const hash = await this.hashPassword(password, cred.salt);
        return hash === cred.passwordHash;
    }

    async hashPassword(password: string, salt: string): Promise<string> {
        const data = new TextEncoder().encode(salt + password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }

    private generateSalt(): string {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }

    private async persistCredentials(): Promise<void> {
        await this.kvStore.set(CREDENTIALS_KEY, this.credentials);
    }
}

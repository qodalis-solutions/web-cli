import {
    ICliAuthService,
    ICliUserSession,
    ICliUserCredentials,
    ICliUsersStoreService,
    ICliUserSessionService,
    ICliKeyValueStore,
    ICliUserEventService,
} from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';
import { CliUsersModuleConfig } from '../models/users-module-config';

const CREDENTIALS_KEY = 'cli-credentials';

interface LoginAttempt {
    count: number;
    lockedUntil: number;
}

export class CliDefaultAuthService implements ICliAuthService {
    private credentials: ICliUserCredentials[] = [];
    private kvStore!: ICliKeyValueStore;
    private usersStore!: ICliUsersStoreService;
    private sessionService!: ICliUserSessionService;
    private eventService?: ICliUserEventService;
    private config?: CliUsersModuleConfig;
    private loginAttempts = new Map<string, LoginAttempt>();

    async initialize(
        kvStore: ICliKeyValueStore,
        usersStore: ICliUsersStoreService,
        sessionService: ICliUserSessionService,
        eventService?: ICliUserEventService,
        config?: CliUsersModuleConfig,
    ): Promise<void> {
        this.kvStore = kvStore;
        this.usersStore = usersStore;
        this.sessionService = sessionService;
        this.eventService = eventService;
        this.config = config;

        const stored =
            await kvStore.get<ICliUserCredentials[]>(CREDENTIALS_KEY);
        this.credentials = stored || [];
    }

    async login(username: string, password: string): Promise<ICliUserSession> {
        // Brute force check
        const bfConfig = this.config?.bruteForceProtection;
        if (bfConfig) {
            const attempt = this.loginAttempts.get(username);
            if (attempt && attempt.lockedUntil > Date.now()) {
                const remaining = Math.ceil(
                    (attempt.lockedUntil - Date.now()) / 1000,
                );
                throw new Error(
                    `login: Account locked. Try again in ${remaining}s`,
                );
            }
        }

        const user = await firstValueFrom(this.usersStore.getUser(username));

        if (!user) {
            this.recordFailedAttempt(username);
            this.emitEvent('login_failed', { id: '', name: username, email: '', groups: [], createdAt: 0, updatedAt: 0 });
            throw new Error('login: Authentication failure');
        }

        if (user.disabled) {
            this.emitEvent('login_failed', user, 'Account is disabled');
            throw new Error('login: Account is disabled');
        }

        const valid = await this.verifyPassword(user.id, password);
        if (!valid) {
            this.recordFailedAttempt(username);
            this.emitEvent('login_failed', user);
            throw new Error('login: Authentication failure');
        }

        // Clear failed attempts on success
        this.loginAttempts.delete(username);

        // Update lastLoginAt
        await this.usersStore.updateUser(user.id, {
            lastLoginAt: Date.now(),
        });

        // Re-fetch to get updated user
        const updatedUser = await firstValueFrom(this.usersStore.getUser(username));

        const session: ICliUserSession = {
            user: updatedUser || user,
            loginTime: Date.now(),
            lastActivity: Date.now(),
        };

        await this.sessionService.setUserSession(session);

        this.emitEvent('login', updatedUser || user);

        return session;
    }

    async logout(): Promise<void> {
        const session = await firstValueFrom(
            this.sessionService.getUserSession(),
        );

        await this.sessionService.clearSession();

        if (session?.user) {
            this.emitEvent('logout', session.user);
        }

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
        const error = this.validatePassword(password);
        if (error) {
            throw new Error(`passwd: ${error}`);
        }

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

        // Emit password change event
        const user = await firstValueFrom(this.usersStore.getUser(userId));
        if (user) {
            this.emitEvent('password_changed', user);
        }
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

    validatePassword(password: string): string | null {
        const policy = this.config?.passwordPolicy;
        if (!policy) return null;

        if (policy.minLength && password.length < policy.minLength) {
            return `Password must be at least ${policy.minLength} characters`;
        }
        if (policy.requireUppercase && !/[A-Z]/.test(password)) {
            return 'Password must contain at least one uppercase letter';
        }
        if (policy.requireDigit && !/\d/.test(password)) {
            return 'Password must contain at least one digit';
        }
        if (policy.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
            return 'Password must contain at least one special character';
        }

        return null;
    }

    private recordFailedAttempt(username: string): void {
        const bfConfig = this.config?.bruteForceProtection;
        if (!bfConfig) return;

        const maxAttempts = bfConfig.maxAttempts ?? 5;
        const lockoutMs = (bfConfig.lockoutSeconds ?? 60) * 1000;

        const attempt = this.loginAttempts.get(username) || {
            count: 0,
            lockedUntil: 0,
        };
        attempt.count++;

        if (attempt.count >= maxAttempts) {
            attempt.lockedUntil = Date.now() + lockoutMs;
            attempt.count = 0; // Reset count for next lockout cycle
        }

        this.loginAttempts.set(username, attempt);
    }

    private emitEvent(
        type: 'login' | 'logout' | 'login_failed' | 'password_changed',
        user: { id: string; name: string; email: string; groups: string[]; createdAt: number; updatedAt: number },
        details?: string,
    ): void {
        this.eventService?.emit({
            type,
            user: user as any,
            timestamp: Date.now(),
            details,
        });
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

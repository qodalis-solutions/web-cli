import {
    ICliKeyValueStore,
    ICliUserSession,
    ICliUserSessionService,
} from '@qodalis/cli-core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CliBackendLogin, CliBackendSession, ICliUsersBackend, isCliUsersError } from '../backend/users-backend';

export interface CliUserSessionOptions {
    /** Host-managed auth: read the bearer token from the host application */
    tokenSource?: () => string | undefined | Promise<string | undefined>;
    /** Persist the token in the KV store (IndexedDB) to survive reloads. Default true */
    persistToken?: boolean;
    /** Called when the backend reports the session as no longer valid */
    onExpired?: (user: ICliUserSession['user']) => void;
}

/**
 * Current sign-in session for this CLI, on top of an {@link ICliUsersBackend}.
 * Holds the session token (persisted in the KV store) and the session
 * (user + effective permissions). Same implementation in both modes.
 *
 * `su` nests sessions like Unix shells: {@link push} suspends the current
 * session (its token stays valid on the backend) and {@link pop} resumes it.
 */
export class CliUserSessionService implements ICliUserSessionService {
    private readonly session$ = new BehaviorSubject<ICliUserSession | undefined>(undefined);
    private token: string | undefined;
    /** Tokens of the sessions suspended by `su`, innermost last */
    private suspended: string[] = [];

    constructor(
        private readonly backend: ICliUsersBackend,
        private readonly kv: ICliKeyValueStore,
        /** KV key the token is stored under */
        private readonly tokenKey: string,
        /** Called whenever the token changes (server auth headers, etc.) */
        private readonly onTokenChange?: (token: string | undefined) => void,
        private readonly options: CliUserSessionOptions = {},
    ) {}

    /** True when the host application supplies the token (see `hostAuth`) */
    get hostManaged(): boolean {
        return !!this.options.tokenSource;
    }

    getUserSession(): Observable<ICliUserSession | undefined> {
        return this.session$.asObservable();
    }

    /** Synchronous snapshot of the current session */
    get current(): ICliUserSession | undefined {
        return this.session$.getValue();
    }

    /** True when the backend runs in the browser (local mode) */
    get isLocal(): boolean {
        return this.backend.kind === 'local';
    }

    /** Number of sessions suspended by `su` under the current one */
    get depth(): number {
        return this.suspended.length;
    }

    /**
     * Record activity: re-reads the session, which slides the idle timeout.
     * Returns false when the session had expired (it is then cleared).
     * Suspended sessions are kept alive too, so `exit` can return to them.
     */
    async touch(): Promise<boolean> {
        if (!this.token) return true;
        for (const token of this.suspended) {
            void this.backend.currentSession(token).catch(() => undefined);
        }
        try {
            return !!(await this.refresh());
        } catch {
            return true; // backend unreachable: do not sign out
        }
    }

    getToken(): string | undefined {
        return this.token;
    }

    /** Backend id of the current session */
    getSessionId(): string | undefined {
        return this.current?.data?.['sessionId'];
    }

    /** Adopt a successful login, replacing every session (suspended ones are ended) */
    async start(login: CliBackendLogin): Promise<ICliUserSession> {
        await this.endSuspended();
        await this.setToken(login.token);
        return this.apply(login.session);
    }

    /** Adopt a successful login on top of the current session (`su`), which is suspended */
    async push(login: CliBackendLogin): Promise<ICliUserSession> {
        if (this.token && this.token !== login.token) {
            this.suspended.push(this.token);
            await this.saveSuspended();
        }
        await this.setToken(login.token);
        return this.apply(login.session);
    }

    /**
     * Resume the innermost suspended session the backend still accepts
     * (`exit` after `su`). Sessions that ended meanwhile are skipped; with none
     * left the CLI is signed out. The current token is not ended here.
     * Throws, leaving everything unchanged, when the backend is unreachable.
     */
    async pop(): Promise<ICliUserSession | undefined> {
        while (this.suspended.length) {
            const token = this.suspended[this.suspended.length - 1];
            let session: CliBackendSession | undefined;
            try {
                session = await this.backend.currentSession(token);
            } catch (e) {
                if (!(isCliUsersError(e) && (e.status === 401 || e.status === 404))) throw e;
            }
            this.suspended.pop();
            await this.saveSuspended();
            if (session) {
                await this.setToken(token);
                return this.apply(session);
            }
        }
        await this.clearSession();
        return undefined;
    }

    /** Re-read the session from the backend (after user/group changes). Clears it on 401. */
    async refresh(): Promise<ICliUserSession | undefined> {
        const token = this.token;
        if (!token) return undefined;
        try {
            const session = await this.backend.currentSession(token);
            // Signed out or switched user meanwhile: the answer is about an old session
            if (this.token !== token) return this.current;
            return this.apply(session);
        } catch (e) {
            if (this.token !== token) return this.current;
            if (isCliUsersError(e) && e.status === 401) {
                const user = this.current?.user;
                await this.clearSession();
                if (user) this.options.onExpired?.(user);
                return undefined;
            }
            throw e;
        }
    }

    /**
     * Interface compatibility. The session cannot be set from outside (that
     * would let code impersonate users): this re-reads the real session from
     * the backend instead. Use `ICliAuthService.login` to sign in.
     */
    async setUserSession(_session: ICliUserSession): Promise<void> {
        await this.refresh();
    }

    /** Sign out completely: the current session and every suspended one */
    async clearSession(): Promise<void> {
        await this.endSuspended();
        await this.setToken(undefined);
        this.session$.next(undefined);
    }

    async persistSession(): Promise<void> {
        // The backend owns the session; only the token is stored locally.
    }

    /**
     * The tokens a previous page load stored (current and suspended; never the
     * host's token), without adopting them. Used to end those sessions when a
     * fresh sign-in is required.
     */
    async storedTokens(): Promise<string[]> {
        if (this.options.tokenSource) return [];
        const token = await this.kv.get<string>(this.tokenKey);
        const suspended = (await this.kv.get<string[]>(this.suspendedKey)) ?? [];
        return [...(token ? [token] : []), ...suspended];
    }

    async restoreSession(): Promise<ICliUserSession | undefined> {
        const token = this.options.tokenSource
            ? await this.options.tokenSource()
            : this.options.persistToken === false
              ? undefined
              : await this.kv.get<string>(this.tokenKey);
        if (!token) return undefined;
        this.token = token;
        if (!this.options.tokenSource && this.options.persistToken !== false) {
            this.suspended = (await this.kv.get<string[]>(this.suspendedKey)) ?? [];
        }
        this.onTokenChange?.(token);
        try {
            return this.apply(await this.backend.currentSession(token));
        } catch (e) {
            if (isCliUsersError(e) && (e.status === 401 || e.status === 404)) {
                await this.clearSession();
                return undefined;
            }
            // Backend unreachable: keep the token, stay signed out for now
            this.session$.next(undefined);
            return undefined;
        }
    }

    private apply(session: CliBackendSession): ICliUserSession {
        const userSession: ICliUserSession = {
            user: session.user,
            loginTime: session.loginTime,
            lastActivity: session.lastActivity,
            permissions: session.permissions ?? [],
            data: {
                sessionId: session.id,
                ...(session.expiresAt ? { expiresAt: session.expiresAt } : {}),
            },
        };
        this.session$.next(userSession);
        return userSession;
    }

    private get suspendedKey(): string {
        return `${this.tokenKey}:suspended`;
    }

    private async saveSuspended(): Promise<void> {
        if (this.options.tokenSource || this.options.persistToken === false || !this.suspended.length) {
            await this.kv.remove(this.suspendedKey);
        } else {
            await this.kv.set(this.suspendedKey, this.suspended);
        }
    }

    /** End the suspended sessions on the backend (best effort) and forget them */
    private async endSuspended(): Promise<void> {
        const tokens = this.suspended;
        if (!tokens.length) return;
        this.suspended = [];
        await this.saveSuspended();
        await Promise.all(tokens.map((t) => this.backend.logout(t).catch(() => undefined)));
    }

    private async setToken(token: string | undefined): Promise<void> {
        this.token = token;
        if (this.options.tokenSource || this.options.persistToken === false) {
            // Never store host-managed or memory-only tokens
            await this.kv.remove(this.tokenKey);
        } else if (token) {
            await this.kv.set(this.tokenKey, token);
        } else {
            await this.kv.remove(this.tokenKey);
        }
        this.onTokenChange?.(token);
    }
}

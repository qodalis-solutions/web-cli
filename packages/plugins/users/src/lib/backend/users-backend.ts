import { ICliAuditEntry, ICliGroup, ICliSessionInfo, ICliUser } from '@qodalis/cli-core';

/**
 * The users "authority": every rule (permissions, validation, cascades,
 * protections, lockout, audit) lives behind this interface.
 *
 * Two implementations share it, so local and server mode behave the same:
 * - {@link CliLocalUsersBackend}: runs in the browser (IndexedDB via the KV store)
 * - {@link CliHttpUsersBackend}: calls a CLI server users plugin (`/api/v1/qcli`)
 *
 * The contract mirrors the server API (see the users design spec, Appendix A).
 * Calls that act on behalf of a user take the session `token`.
 */
export interface ICliUsersBackend {
    /** `local` or `server` */
    readonly kind: 'local' | 'server';

    // ── sessions / auth ──────────────────────────────────────────────
    /** POST /sessions. `trusted` skips the password check (local passwordless mode only). */
    login(username: string, password: string | undefined, options?: { trusted?: boolean }): Promise<CliBackendLogin>;
    /** DELETE /sessions/current */
    logout(token: string): Promise<void>;
    /** GET /sessions/current (also slides the idle timeout) */
    currentSession(token: string): Promise<CliBackendSession>;
    /** GET /sessions */
    listSessions(token: string): Promise<ICliSessionInfo[]>;
    /** DELETE /sessions/{id} */
    revokeSession(token: string, sessionId: string, reason?: string): Promise<void>;
    /** POST /sessions/ws-ticket: single-use ticket for WebSocket upgrades (server backends) */
    createWebSocketTicket?(token: string): Promise<{ ticket: string; expiresIn: number }>;

    // ── users ────────────────────────────────────────────────────────
    listUsers(token: string, options?: { query?: string; skip?: number; take?: number }): Promise<ICliUser[]>;
    getUser(token: string, idOrName: string): Promise<ICliUser | undefined>;
    getUserPermissions(token: string, idOrName: string): Promise<CliBackendUserPermissions>;
    createUser(token: string, user: CliBackendCreateUser): Promise<ICliUser>;
    updateUser(token: string, idOrName: string, updates: CliBackendUpdateUser): Promise<ICliUser>;
    deleteUser(token: string, idOrName: string): Promise<void>;
    /** `temporary` (default true for resets of other users) forces a change at next sign-in */
    setPassword(
        token: string,
        idOrName: string,
        password: string,
        currentPassword?: string,
        options?: { temporary?: boolean },
    ): Promise<void>;
    verifyPassword(token: string, idOrName: string, password: string): Promise<boolean>;

    // ── groups (roles) ───────────────────────────────────────────────
    listGroups(token: string): Promise<ICliGroup[]>;
    getGroup(token: string, name: string): Promise<ICliGroup | undefined>;
    getGroupMembers(token: string, name: string): Promise<ICliUser[]>;
    createGroup(token: string, group: { name: string; description?: string; permissions?: string[] }): Promise<ICliGroup>;
    updateGroup(token: string, name: string, updates: { description?: string; permissions?: string[] }): Promise<ICliGroup>;
    deleteGroup(token: string, name: string): Promise<void>;
    addGroupMember(token: string, group: string, user: string): Promise<void>;
    removeGroupMember(token: string, group: string, user: string): Promise<void>;

    // ── API tokens (server backends) ─────────────────────────────────
    /** GET /tokens (`all`: every user's tokens, requires tokens:read) */
    listApiTokens?(token: string, options?: { all?: boolean }): Promise<CliApiToken[]>;
    /** POST /tokens (session only). The token is returned once and never stored. */
    createApiToken?(token: string, request: CliCreateApiToken): Promise<CliCreatedApiToken>;
    /** DELETE /tokens/{id} (own token, or any with tokens:revoke) */
    revokeApiToken?(token: string, tokenId: string): Promise<void>;

    // ── audit ────────────────────────────────────────────────────────
    listAudit(token: string, options?: { limit?: number; event?: string; username?: string }): Promise<ICliAuditEntry[]>;
    clearAudit(token: string): Promise<void>;

    /** Release timers/subscriptions */
    dispose?(): void;
}

export interface CliBackendSession {
    id: string;
    user: ICliUser;
    permissions: string[];
    loginTime: number;
    lastActivity: number;
    expiresAt?: number;
}

export interface CliBackendLogin {
    token: string;
    session: CliBackendSession;
}

export interface CliBackendUserPermissions {
    userId: string;
    groups: string[];
    permissions: string[];
}

/** An API token as the server shows it (never contains the token itself). */
export interface CliApiToken {
    id: string;
    name: string;
    userId: string;
    userName: string;
    createdAt: number;
    /** null: never expires */
    expiresAt: number | null;
    /** null: never used */
    lastUsedAt: number | null;
    /** Scope; omitted/null when the token carries the user's full permissions */
    permissions?: string[] | null;
}

export interface CliCreateApiToken {
    name: string;
    /** 1-365 (server default 90); null = never expires (if the server allows it) */
    expiresInDays?: number | null;
    /** Optional scope, each entry covered by the caller's permissions */
    permissions?: string[];
}

export interface CliCreatedApiToken {
    /** The bearer token (`qcli_pat_…`), shown once */
    token: string;
    apiToken: CliApiToken;
}

export interface CliBackendCreateUser {
    name: string;
    email: string;
    groups?: string[];
    password?: string;
    disabled?: boolean;
    homeDir?: string;
    data?: Record<string, any>;
}

export type CliBackendUpdateUser = Partial<Omit<CliBackendCreateUser, 'password'>> & {
    /** Local only: bookkeeping updates such as lastLoginAt */
    lastLoginAt?: number;
};

/**
 * Error raised by a backend. `status` follows HTTP semantics in both modes
 * (400 validation, 401 not signed in, 403 forbidden, 404 not found,
 * 409 conflict, 429 locked out, 501 not supported).
 */
export class CliUsersError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = 'CliUsersError';
        Object.setPrototypeOf(this, CliUsersError.prototype);
    }
}

export function isCliUsersError(e: unknown): e is CliUsersError {
    return e instanceof CliUsersError || (!!e && typeof e === 'object' && (e as any).name === 'CliUsersError');
}

/** Built-in groups (roles) present in both modes. */
export const BUILTIN_GROUPS: ReadonlyArray<{ name: string; description: string; permissions: string[] }> = [
    { name: 'admin', description: 'Administrators (all permissions)', permissions: ['*'] },
    { name: 'users', description: 'Default group for new accounts', permissions: ['commands:execute'] },
];

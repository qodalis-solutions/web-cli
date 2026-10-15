import {
    CliAccessAction,
    CliAddUser,
    CliUpdateUser,
    cliEvaluateAccess,
    cliHasPermission,
    ICliAuditEntry,
    ICliAuditService,
    ICliAuthorizationService,
    ICliAuthService,
    ICliGroup,
    ICliGroupsStoreService,
    ICliPrincipal,
    ICliProtectedResource,
    ICliSessionInfo,
    ICliSessionsService,
    ICliUser,
    ICliUserEvent,
    ICliUserEventService,
    ICliUserSession,
    ICliUsersStoreService,
} from '@qodalis/cli-core';
import { from, Observable } from 'rxjs';
import { CliUsersError, ICliUsersBackend } from '../backend/users-backend';
import { hashPassword } from '../backend/password-hashing';
import { assertCustomAuditEvent } from '../backend/validation';
import { CliUserSessionService } from './cli-user-session.service';

/** Placeholder user for events about an unknown account (e.g. failed login). */
const unknownUser = (name: string): ICliUser => ({
    id: '',
    name,
    email: '',
    groups: [],
    createdAt: 0,
    updatedAt: 0,
});

/** Shared plumbing: token access + event emission. */
abstract class CliUsersServiceBase {
    constructor(
        protected readonly backend: ICliUsersBackend,
        protected readonly session: CliUserSessionService,
        protected readonly events?: ICliUserEventService,
    ) {}

    protected get token(): string {
        const token = this.session.getToken();
        if (!token) throw new CliUsersError(401, 'not logged in');
        return token;
    }

    protected get actorName(): string | undefined {
        return this.session.current?.user.name;
    }

    protected emit(type: ICliUserEvent['type'], user: ICliUser, details?: string, extra?: Partial<ICliUserEvent>): void {
        const actor = this.actorName;
        this.events?.emit({
            ...extra,
            type,
            user,
            timestamp: Date.now(),
            ...(details ? { details } : {}),
            ...(actor && actor !== user.name ? { actor } : {}),
        });
    }

    /** Re-read the current session when `user` is the signed-in user (or always). */
    protected async refreshIfCurrent(userIdOrName?: string): Promise<void> {
        const me = this.session.current?.user;
        if (!me) return;
        if (userIdOrName === undefined || userIdOrName === me.id || userIdOrName.toLowerCase() === me.name.toLowerCase()) {
            await this.session.refresh();
        }
    }
}

// ── auth ─────────────────────────────────────────────────────────────

export interface CliUsersAuthOptions {
    /** Allow passwordless login/su (local mode with `requirePassword: false`) */
    passwordless?: boolean;
    /** Password policy pre-check (same rules the backend enforces locally) */
    validatePassword?: (password: string) => string | null;
    /** Host-managed auth (see CliUsersModuleConfig.hostAuth) */
    hostAuth?: { loginHint?: string; logout?: () => void | Promise<void> };
}

export class CliUsersAuthService extends CliUsersServiceBase implements ICliAuthService {
    constructor(
        backend: ICliUsersBackend,
        session: CliUserSessionService,
        events: ICliUserEventService | undefined,
        private readonly options: CliUsersAuthOptions = {},
    ) {
        super(backend, session, events);
    }

    /** Whether login/su may skip the password */
    get passwordless(): boolean {
        return !!this.options.passwordless && this.backend.kind === 'local';
    }

    /** True when sign-in is handled by the host application */
    get hostManaged(): boolean {
        return !!this.options.hostAuth;
    }

    /**
     * Host-managed auth: pick up the host's current token (e.g. after the
     * user signed in to the host application).
     */
    async syncFromHost(): Promise<ICliUserSession | undefined> {
        const session = await this.session.restoreSession();
        if (session) this.emit('login', session.user, 'host session');
        return session;
    }

    async login(username: string, password?: string): Promise<ICliUserSession> {
        if (this.options.hostAuth) {
            const synced = await this.syncFromHost();
            if (synced) return synced;
            throw new CliUsersError(
                501,
                this.options.hostAuth.loginHint ?? 'sign-in is managed by the host application',
            );
        }
        try {
            const result = await this.backend.login(username, password, {
                trusted: password === undefined && this.passwordless,
            });
            // Replacing an existing session: end the old one on the backend
            const previous = this.session.getToken();
            const session = await this.session.start(result);
            if (previous && previous !== result.token) {
                await this.backend.logout(previous).catch(() => undefined);
            }
            this.emit('login', session.user);
            return session;
        } catch (e) {
            this.emit('login_failed', unknownUser(username), (e as Error)?.message);
            throw e;
        }
    }

    async logout(): Promise<void> {
        if (this.options.hostAuth) {
            if (!this.options.hostAuth.logout) {
                throw new CliUsersError(501, 'log out in the host application');
            }
            const user = this.session.current?.user;
            await this.options.hostAuth.logout();
            await this.session.clearSession();
            if (user) this.emit('logout', user);
            return;
        }
        const current = this.session.current;
        const token = this.session.getToken();
        if (token) await this.backend.logout(token).catch(() => undefined);
        await this.session.clearSession();
        if (current?.user) this.emit('logout', current.user);
    }

    async switchUser(username: string, password?: string): Promise<ICliUserSession> {
        if (this.options.hostAuth) throw new CliUsersError(501, 'switching users is managed by the host application');
        const from = this.session.current?.user;
        const session = await this.login(username, password);
        this.emit('user_switched', session.user, from ? `from ${from.name}` : undefined);
        return session;
    }

    /** End the local session without calling the backend (token already invalid). */
    async forgetSession(reason: string): Promise<ICliUser | undefined> {
        const user = this.session.current?.user;
        await this.session.clearSession();
        if (user) this.emit('logout', user, reason);
        return user;
    }

    async setPassword(userId: string, password: string, currentPassword?: string): Promise<void> {
        const policyError = this.validatePassword(password);
        if (policyError) throw new CliUsersError(400, policyError);
        await this.backend.setPassword(this.token, userId, password, currentPassword);
        const me = this.session.current?.user;
        const isSelf = !!me && (userId === me.id || userId.toLowerCase() === me.name.toLowerCase());
        if (isSelf) await this.session.refresh(); // clears mustChangePassword
        const user = isSelf ? this.session.current?.user : await this.backend.getUser(this.token, userId).catch(() => undefined);
        this.emit('password_changed', user ?? unknownUser(userId));
    }

    verifyPassword(userId: string, password: string): Promise<boolean> {
        return this.backend.verifyPassword(this.token, userId, password);
    }

    hashPassword(password: string): Promise<string> {
        return hashPassword(password);
    }

    validatePassword(password: string): string | null {
        return this.options.validatePassword?.(password) ?? null;
    }
}

// ── users ────────────────────────────────────────────────────────────

export class CliUsersStoreService extends CliUsersServiceBase implements ICliUsersStoreService {
    getUsers(options?: { query?: string; skip?: number; take?: number }): Observable<ICliUser[]> {
        return from(this.backend.listUsers(this.token, options));
    }

    getUser(id: string): Observable<ICliUser | undefined> {
        return from(this.backend.getUser(this.token, id));
    }

    async createUser(user: CliAddUser & { password?: string }): Promise<ICliUser> {
        const created = await this.backend.createUser(this.token, {
            name: user.name,
            email: user.email,
            groups: user.groups,
            disabled: user.disabled,
            homeDir: user.homeDir,
            data: user.data,
            password: user.password,
        });
        this.emit('user_created', created);
        return created;
    }

    async updateUser(id: string, updates: CliUpdateUser): Promise<ICliUser> {
        const before = await this.backend.getUser(this.token, id).catch(() => undefined);
        const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = updates as any;
        const updated = await this.backend.updateUser(this.token, id, rest);
        if (before && !before.disabled && updated.disabled) this.emit('user_disabled', updated);
        if (before?.disabled && !updated.disabled) this.emit('user_enabled', updated);
        // Renames carry the old name (e.g. so file ownership can follow the user)
        const renamed = before && before.name !== updated.name ? { previousName: before.name } : undefined;
        this.emit('user_updated', updated, Object.keys(rest).join(','), renamed);
        await this.refreshIfCurrent(updated.id);
        return updated;
    }

    async deleteUser(id: string): Promise<void> {
        const user = await this.backend.getUser(this.token, id).catch(() => undefined);
        await this.backend.deleteUser(this.token, id);
        this.emit('user_deleted', user ?? unknownUser(id));
    }

    /** Effective permissions and groups of a user */
    getPermissions(id: string): Promise<{ userId: string; groups: string[]; permissions: string[] }> {
        return this.backend.getUserPermissions(this.token, id);
    }
}

// ── groups (roles) ───────────────────────────────────────────────────

export class CliGroupsStoreService extends CliUsersServiceBase implements ICliGroupsStoreService {
    getGroups(): Observable<ICliGroup[]> {
        return from(this.backend.listGroups(this.token));
    }

    getGroup(id: string): Observable<ICliGroup | undefined> {
        return from(this.backend.getGroup(this.token, id));
    }

    async createGroup(name: string, description?: string, permissions?: string[]): Promise<ICliGroup> {
        const group = await this.backend.createGroup(this.token, {
            name,
            ...(description ? { description } : {}),
            ...(permissions ? { permissions } : {}),
        });
        this.emitGroup('group_created', group.name);
        return group;
    }

    async updateGroup(id: string, updates: { description?: string; permissions?: string[] }): Promise<ICliGroup> {
        const group = await this.backend.updateGroup(this.token, id, updates);
        this.emitGroup('group_updated', group.name);
        // Members' permissions may have changed (including ours)
        await this.refreshIfCurrent();
        return group;
    }

    async deleteGroup(id: string): Promise<void> {
        await this.backend.deleteGroup(this.token, id);
        this.emitGroup('group_deleted', id);
        await this.refreshIfCurrent();
    }

    getGroupMembers(groupId: string): Observable<ICliUser[]> {
        return from(this.backend.getGroupMembers(this.token, groupId));
    }

    async addMember(groupId: string, userId: string): Promise<void> {
        await this.backend.addGroupMember(this.token, groupId, userId);
        const user = await this.backend.getUser(this.token, userId).catch(() => undefined);
        this.emit('group_member_added', user ?? unknownUser(userId), groupId);
        await this.refreshIfCurrent(user?.id ?? userId);
    }

    async removeMember(groupId: string, userId: string): Promise<void> {
        await this.backend.removeGroupMember(this.token, groupId, userId);
        const user = await this.backend.getUser(this.token, userId).catch(() => undefined);
        this.emit('group_member_removed', user ?? unknownUser(userId), groupId);
        await this.refreshIfCurrent(user?.id ?? userId);
    }

    private emitGroup(type: ICliUserEvent['type'], groupName: string): void {
        const me = this.session.current?.user;
        if (me) this.emit(type, me, groupName);
    }
}

// ── sessions ─────────────────────────────────────────────────────────

export class CliSessionsService extends CliUsersServiceBase implements ICliSessionsService {
    list(): Promise<ICliSessionInfo[]> {
        return this.backend.listSessions(this.token);
    }

    async revoke(sessionId: string, reason?: string): Promise<void> {
        await this.backend.revokeSession(this.token, sessionId, reason);
        const me = this.session.current?.user;
        if (me) this.emit('session_revoked', me, sessionId);
    }

    async revokeUser(userId: string, options: { exceptSessionId?: string; reason?: string } = {}): Promise<void> {
        const user = await this.backend.getUser(this.token, userId);
        const sessions = await this.list();
        for (const s of sessions) {
            if ((s.userId === userId || s.userId === user?.id) && s.id !== options.exceptSessionId) {
                await this.revoke(s.id, options.reason);
            }
        }
    }
}

// ── audit ────────────────────────────────────────────────────────────

/**
 * Audit trail. Built-in entries (login, logout, user_*, group_*, ...) are
 * written by the backend (locally or on the server) for every
 * security-relevant action; {@link log} rejects those event names, so they
 * cannot be forged from commands or extensions.
 */
export class CliUsersAuditService extends CliUsersServiceBase implements ICliAuditService {
    constructor(
        backend: ICliUsersBackend,
        session: CliUserSessionService,
        events: ICliUserEventService | undefined,
        /** Optional sink for entries logged by extensions (local mode only) */
        private readonly appendLocal?: (event: string, username: string, details?: string) => Promise<void>,
    ) {
        super(backend, session, events);
    }

    /**
     * Record a custom (extension) event. Built-in event names are reserved
     * (400); the entry is attributed to the signed-in user, whatever
     * `username` / `actor` the caller passes.
     */
    async log(entry: Omit<ICliAuditEntry, 'timestamp'>): Promise<void> {
        const event = assertCustomAuditEvent(entry?.event);
        const user = this.session.current?.user;
        if (!user) throw new CliUsersError(401, 'not logged in');
        // Server mode: the server writes its own audit trail; extension entries are local only
        await this.appendLocal?.(event, user.name, entry.details);
    }

    getEntries(options?: { limit?: number; event?: string; username?: string }): Promise<ICliAuditEntry[]> {
        return this.backend.listAudit(this.token, options);
    }

    async clear(): Promise<void> {
        await this.backend.clearAudit(this.token);
        const me = this.session.current?.user;
        if (me) this.emit('audit_cleared', me);
    }
}

// ── authorization ────────────────────────────────────────────────────

/** {@link ICliAuthorizationService} backed by the current session's effective permissions. */
export class CliUsersAuthorizationService implements ICliAuthorizationService {
    constructor(private readonly session: CliUserSessionService) {}

    getPrincipal(): ICliPrincipal | undefined {
        const s = this.session.current;
        if (!s?.user) return undefined;
        return {
            id: s.user.id,
            name: s.user.name,
            groups: [...(s.user.groups ?? [])],
            permissions: [...(s.permissions ?? [])],
        };
    }

    can(permission: string): boolean {
        return cliHasPermission(this.session.current?.permissions, permission);
    }

    canAccess(resource: ICliProtectedResource, action: CliAccessAction, bypassPermissions?: string[]): boolean {
        return cliEvaluateAccess(this.getPrincipal(), resource, action, bypassPermissions);
    }
}

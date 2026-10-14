import {
    cliHasPermission,
    cliMergePermissions,
    ICliAuditEntry,
    ICliGroup,
    ICliKeyValueStore,
    ICliSessionInfo,
    ICliUser,
    ICliUserCredentials,
} from '@qodalis/cli-core';
import {
    BUILTIN_GROUPS,
    CliBackendCreateUser,
    CliBackendLogin,
    CliBackendSession,
    CliBackendUpdateUser,
    CliBackendUserPermissions,
    CliUsersError,
    ICliUsersBackend,
} from './users-backend';
import { hashPassword, verifyPasswordHash } from './password-hashing';
import {
    assertData,
    assertEmail,
    assertName,
    assertPermissions,
    assertText,
    covers,
    sanitizeForAudit,
} from './validation';

export const LOCAL_KEYS = {
    users: 'cli-users',
    groups: 'cli-groups',
    credentials: 'cli-credentials',
    sessions: 'cli-local-sessions',
    audit: 'cli-audit-log',
    attempts: 'cli-users-lockout',
} as const;

const MAX_AUDIT_ENTRIES = 1000;
const MAX_FAILED_LOGIN_ENTRIES = 200;
const DEFAULT_MAX_SESSION_LIFETIME = 12 * 60 * 60_000;

export interface CliLocalUsersBackendOptions {
    /** Idle session timeout in ms (0 = none) */
    sessionTimeoutMs?: number;
    /** Absolute session lifetime in ms (default 12 h, 0 = none) */
    maxSessionLifetimeMs?: number;
    /** Password policy validator; returns an error message or null */
    validatePassword?: (password: string) => string | null;
    /** Failed logins before lockout (0 disables). Default 5 */
    maxLoginAttempts?: number;
    /** Lockout duration in ms. Default 5 min */
    lockoutMs?: number;
    /** Allow `login(name, undefined, { trusted: true })` (passwordless mode) */
    allowTrustedLogin?: boolean;
    /** PBKDF2 iterations (default 100000) */
    hashIterations?: number;
    /** Called when a session is revoked (kick, user disabled/deleted, password change) */
    onSessionRevoked?: (info: { sessionId: string; userId: string; reason: string }) => void;
}

interface LocalSession {
    id: string;
    token: string;
    userId: string;
    createdAt: number;
    lastActivity: number;
    metadata?: { userAgent?: string };
}

interface LoginAttempt {
    count: number;
    lockedUntil: number;
}

const randomId = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);

const randomToken = (): string => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * In-browser implementation of the users contract (same rules as the servers).
 * State is persisted through the CLI key-value store (IndexedDB).
 */
export class CliLocalUsersBackend implements ICliUsersBackend {
    readonly kind = 'local' as const;

    private users: ICliUser[] = [];
    private groups: ICliGroup[] = [];
    private credentials: ICliUserCredentials[] = [];
    private sessions: LocalSession[] = [];
    private audit: ICliAuditEntry[] = [];
    private attempts: Record<string, LoginAttempt> = {};

    constructor(
        private readonly kv: ICliKeyValueStore,
        private readonly options: CliLocalUsersBackendOptions = {},
    ) {}

    /** Load state, migrate old data, seed built-in groups. */
    async initialize(): Promise<void> {
        this.users = ((await this.kv.get<ICliUser[]>(LOCAL_KEYS.users)) ?? []).map((u) => ({
            ...u,
            groups: u.groups ?? [],
            disabled: !!u.disabled,
        }));
        this.groups = ((await this.kv.get<ICliGroup[]>(LOCAL_KEYS.groups)) ?? []).map((g) => ({
            ...g,
            permissions: g.permissions ?? (eq(g.name, 'admin') ? ['*'] : []),
        }));
        this.credentials = (await this.kv.get<ICliUserCredentials[]>(LOCAL_KEYS.credentials)) ?? [];
        this.sessions = (await this.kv.get<LocalSession[]>(LOCAL_KEYS.sessions)) ?? [];
        this.audit = (await this.kv.get<ICliAuditEntry[]>(LOCAL_KEYS.audit)) ?? [];
        this.attempts = (await this.kv.get<Record<string, LoginAttempt>>(LOCAL_KEYS.attempts)) ?? {};
        this.users.forEach((u) => ((u as any).mustChangePassword = !!(u as any).mustChangePassword));

        let changed = false;
        for (const builtin of BUILTIN_GROUPS) {
            const existing = this.findGroup(builtin.name);
            if (!existing) {
                const now = Date.now();
                this.groups.push({
                    id: builtin.name,
                    name: builtin.name,
                    description: builtin.description,
                    permissions: [...builtin.permissions],
                    builtIn: true,
                    createdAt: now,
                    updatedAt: now,
                } as ICliGroup);
                changed = true;
            } else if (!(existing as any).builtIn) {
                (existing as any).builtIn = true;
                changed = true;
            }
        }
        // admin always holds every permission
        const admin = this.findGroup('admin')!;
        if (!cliHasPermission(admin.permissions, '*')) {
            admin.permissions = ['*'];
            changed = true;
        }
        this.pruneExpiredSessions();
        if (changed) await this.persist('groups');
    }

    // ── sessions / auth ──────────────────────────────────────────────

    async login(
        username: string,
        password: string | undefined,
        options: { trusted?: boolean } = {},
    ): Promise<CliBackendLogin> {
        const name = (username ?? '').trim();
        if (!name) throw new CliUsersError(400, 'username is required');
        const user = this.findUser(name);
        const lockKey = user ? `id:${user.id}` : `name:${name.toLowerCase()}`;

        this.assertNotLocked(lockKey);

        const trusted = !!options.trusted && !!this.options.allowTrustedLogin;
        if (!trusted && password === undefined) {
            throw new CliUsersError(400, 'password is required');
        }

        if (!user) {
            this.recordFailure(lockKey);
            await this.log('login_failed', sanitizeForAudit(name), 'unknown user');
            throw new CliUsersError(401, 'invalid credentials');
        }
        if (!trusted && !(await this.checkPassword(user.id, password!))) {
            this.recordFailure(lockKey);
            await this.log('login_failed', user.name, 'invalid password');
            throw new CliUsersError(401, 'invalid credentials');
        }
        if (user.disabled) {
            await this.log('login_failed', user.name, 'account disabled');
            throw new CliUsersError(403, 'account disabled');
        }

        delete this.attempts[lockKey];
        await this.persist('attempts');
        const now = Date.now();
        user.lastLoginAt = now;
        user.updatedAt = now;
        const session: LocalSession = {
            id: randomId(),
            token: randomToken(),
            userId: user.id,
            createdAt: now,
            lastActivity: now,
            metadata: {
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            },
        };
        this.sessions.push(session);
        await this.persist('users', 'sessions');
        await this.log('login', user.name, trusted ? 'passwordless' : undefined);
        return { token: session.token, session: this.toBackendSession(session, user) };
    }

    async logout(token: string): Promise<void> {
        const session = this.sessions.find((s) => s.token === token);
        if (!session) return;
        this.sessions = this.sessions.filter((s) => s !== session);
        await this.persist('sessions');
        const user = this.findUserById(session.userId);
        await this.log('logout', user?.name ?? session.userId);
    }

    async currentSession(token: string): Promise<CliBackendSession> {
        const { session, user } = this.authenticate(token, true);
        session.lastActivity = Date.now();
        await this.persist('sessions');
        return this.toBackendSession(session, user);
    }

    async listSessions(token: string): Promise<ICliSessionInfo[]> {
        const actor = this.authenticate(token);
        this.requirePermission(actor.user, 'sessions:read');
        return this.sessions.map((s) => this.toSessionInfo(s, s.token === token));
    }

    async revokeSession(token: string, sessionId: string, reason = 'revoked'): Promise<void> {
        const actor = this.authenticate(token);
        const target = this.sessions.find((s) => s.id === sessionId);
        if (!target) throw new CliUsersError(404, `session not found: ${sessionId}`);
        if (target.userId !== actor.user.id) {
            this.requirePermission(actor.user, 'sessions:revoke');
            const owner = this.findUserById(target.userId);
            if (owner) this.requireCovers(actor.user, owner);
        }
        await this.revokeSessions([target], reason, actor.user.name);
    }

    // ── users ────────────────────────────────────────────────────────

    async listUsers(token: string, options: { query?: string; skip?: number; take?: number } = {}): Promise<ICliUser[]> {
        const actor = this.authenticate(token);
        this.requirePermission(actor.user, 'users:read');
        let list = [...this.users];
        if (options.query) {
            const q = options.query.toLowerCase();
            list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
        }
        if (options.skip) list = list.slice(options.skip);
        if (options.take) list = list.slice(0, options.take);
        return list.map((u) => ({ ...u }));
    }

    async getUser(token: string, idOrName: string): Promise<ICliUser | undefined> {
        const actor = this.authenticate(token);
        const user = this.findUser(idOrName);
        if (!user) return undefined;
        if (user.id !== actor.user.id) this.requirePermission(actor.user, 'users:read');
        return { ...user };
    }

    async getUserPermissions(token: string, idOrName: string): Promise<CliBackendUserPermissions> {
        const actor = this.authenticate(token);
        const user = this.requireUser(idOrName);
        if (user.id !== actor.user.id) this.requirePermission(actor.user, 'users:read');
        return { userId: user.id, groups: [...user.groups], permissions: this.effectivePermissions(user) };
    }

    async createUser(token: string, input: CliBackendCreateUser): Promise<ICliUser> {
        const actor = this.authenticate(token);
        this.requirePermission(actor.user, 'users:create');
        // The default `users` group is not an escalation; explicitly requested groups are checked
        if (input.groups?.length) this.requireCanAssignGroups(actor.user, input.groups);
        return this.createUserInternal(input, actor.user);
    }

    /** Create without an actor (seeding, first-run wizard). */
    async createUserInternal(
        input: CliBackendCreateUser & { mustChangePassword?: boolean; skipPasswordPolicy?: boolean },
        actor?: ICliUser,
    ): Promise<ICliUser> {
        const name = assertName(input.name);
        const email = assertEmail(input.email);
        assertText(input.homeDir, 'home directory', 256);
        assertData(input.data);
        if (this.findUser(name)) throw new CliUsersError(409, `user already exists: ${name}`);
        if (this.findUser(email)) throw new CliUsersError(409, `email already in use: ${email}`);
        const groups = this.normalizeGroups(input.groups?.length ? input.groups : ['users']);
        if (input.password !== undefined && !input.skipPasswordPolicy) this.assertPasswordPolicy(input.password);

        const now = Date.now();
        const user: ICliUser = {
            id: randomId(),
            name,
            email,
            groups,
            disabled: !!input.disabled,
            mustChangePassword: !!input.mustChangePassword,
            createdAt: now,
            updatedAt: now,
            ...(input.homeDir ? { homeDir: input.homeDir } : {}),
            ...(input.data ? { data: input.data } : {}),
        };
        this.users.push(user);
        if (input.password !== undefined) {
            await this.storeCredentials(user.id, input.password);
        }
        await this.persist('users', 'credentials');
        await this.log('user_created', user.name, undefined, actor, user);
        return { ...user };
    }

    async updateUser(token: string, idOrName: string, updates: CliBackendUpdateUser): Promise<ICliUser> {
        const actor = this.authenticate(token);
        const user = this.requireUser(idOrName);
        const isSelf = user.id === actor.user.id;
        const privileged = Object.keys(updates).some(
            (k) => !['email', 'data'].includes(k) && (updates as any)[k] !== undefined,
        );
        if (!isSelf || privileged) this.requirePermission(actor.user, 'users:update');
        if (!isSelf) this.requireCovers(actor.user, user);

        if (updates.name !== undefined) {
            const name = assertName(updates.name);
            const other = this.findUser(name);
            if (other && other.id !== user.id) throw new CliUsersError(409, `user already exists: ${name}`);
        }
        if (updates.email !== undefined) {
            const email = assertEmail(updates.email);
            const other = this.findUser(email);
            if (other && other.id !== user.id) throw new CliUsersError(409, `email already in use: ${email}`);
        }
        assertText(updates.homeDir, 'home directory', 256);
        assertData(updates.data);
        let groups: string[] | undefined;
        if (updates.groups !== undefined) {
            groups = this.normalizeGroups(updates.groups);
            const added = groups.filter((g) => !user.groups.some((x) => eq(x, g)));
            this.requireCanAssignGroups(actor.user, added);
            const losesAdmin = this.isAdmin(user) && !groups.some((g) => eq(g, 'admin'));
            if (losesAdmin && this.isLastAdmin(user)) {
                throw new CliUsersError(409, 'cannot remove the last administrator from the admin group');
            }
        }
        if (updates.disabled === true && !user.disabled) {
            if (user.id === actor.user.id) throw new CliUsersError(409, 'cannot disable your own account');
            if (this.isLastAdmin(user)) throw new CliUsersError(409, 'cannot disable the last administrator');
        }

        const wasDisabled = !!user.disabled;
        if (updates.name !== undefined) user.name = assertName(updates.name);
        if (updates.email !== undefined) user.email = assertEmail(updates.email);
        if (groups) user.groups = groups;
        if (updates.disabled !== undefined) user.disabled = updates.disabled;
        if (updates.homeDir !== undefined) user.homeDir = updates.homeDir;
        if (updates.data !== undefined) user.data = updates.data;
        if (updates.lastLoginAt !== undefined) user.lastLoginAt = updates.lastLoginAt;
        user.updatedAt = Date.now();
        await this.persist('users');

        if (!wasDisabled && user.disabled) {
            await this.log('user_disabled', user.name, undefined, actor.user.name);
            await this.revokeSessions(this.sessions.filter((s) => s.userId === user.id), 'account disabled', actor.user.name);
        } else if (wasDisabled && !user.disabled) {
            await this.log('user_enabled', user.name, undefined, actor.user.name);
        }
        await this.log('user_updated', user.name, Object.keys(updates).join(','), actor.user.name);
        return { ...user };
    }

    async deleteUser(token: string, idOrName: string): Promise<void> {
        const actor = this.authenticate(token);
        this.requirePermission(actor.user, 'users:delete');
        const user = this.requireUser(idOrName);
        if (user.id === actor.user.id) throw new CliUsersError(409, 'cannot delete your own account');
        this.requireCovers(actor.user, user);
        if (this.isLastAdmin(user)) throw new CliUsersError(409, 'cannot delete the last administrator');

        this.users = this.users.filter((u) => u.id !== user.id);
        this.credentials = this.credentials.filter((c) => c.userId !== user.id);
        await this.persist('users', 'credentials');
        await this.revokeSessions(this.sessions.filter((s) => s.userId === user.id), 'account deleted', actor.user.name);
        await this.log('user_deleted', user.name, undefined, actor.user.name);
    }

    async setPassword(
        token: string,
        idOrName: string,
        password: string,
        currentPassword?: string,
        options: { temporary?: boolean } = {},
    ): Promise<void> {
        const actor = this.authenticate(token, true);
        const user = this.requireUser(idOrName);
        const isSelf = user.id === actor.user.id;
        if (!isSelf && (actor.user as any).mustChangePassword) {
            throw new CliUsersError(403, 'password change required');
        }
        if (!password) throw new CliUsersError(400, 'password is required');

        if (isSelf) {
            const hasCredentials = this.credentials.some((c) => c.userId === user.id);
            if (hasCredentials && !cliHasPermission(this.effectivePermissions(actor.user), 'users:update')) {
                if (currentPassword === undefined) throw new CliUsersError(400, 'current password is required');
                const lockKey = `id:${user.id}`;
                this.assertNotLocked(lockKey);
                if (!(await this.checkPassword(user.id, currentPassword))) {
                    this.recordFailure(lockKey);
                    await this.log('login_failed', user.name, 'current password mismatch', actor.user);
                    throw new CliUsersError(403, 'current password is incorrect');
                }
            }
        } else {
            this.requirePermission(actor.user, 'users:update');
            this.requireCovers(actor.user, user);
        }
        this.assertPasswordPolicy(password);
        await this.storeCredentials(user.id, password);
        // Self change clears the flag; an admin reset is temporary unless stated otherwise
        (user as any).mustChangePassword = isSelf ? false : options.temporary !== false;
        user.updatedAt = Date.now();
        if (!isSelf) {
            delete this.attempts[`id:${user.id}`];
            await this.persist('attempts');
        }
        await this.persist('credentials', 'users');
        await this.log('password_changed', user.name, isSelf ? undefined : 'reset', actor.user.name);

        const current = this.sessions.find((s) => s.token === token);
        const toRevoke = this.sessions.filter(
            (s) => s.userId === user.id && (!isSelf || s.id !== current?.id),
        );
        await this.revokeSessions(toRevoke, 'password changed', actor.user.name);
    }

    async verifyPassword(token: string, idOrName: string, password: string): Promise<boolean> {
        const actor = this.authenticate(token);
        const user = this.requireUser(idOrName);
        if (user.id !== actor.user.id) this.requirePermission(actor.user, 'users:update');
        const lockKey = `id:${user.id}`;
        this.assertNotLocked(lockKey);
        const valid = await this.checkPassword(user.id, password);
        if (!valid) {
            this.recordFailure(lockKey);
            await this.log('login_failed', user.name, 'password verification failed', actor.user.name);
        }
        return valid;
    }

    // ── groups ───────────────────────────────────────────────────────

    async listGroups(token: string): Promise<ICliGroup[]> {
        this.authenticate(token);
        return this.groups.map((g) => ({ ...g, permissions: [...(g.permissions ?? [])] }));
    }

    async getGroup(token: string, name: string): Promise<ICliGroup | undefined> {
        this.authenticate(token);
        const group = this.findGroup(name);
        return group ? { ...group, permissions: [...(group.permissions ?? [])] } : undefined;
    }

    async getGroupMembers(token: string, name: string): Promise<ICliUser[]> {
        const actor = this.authenticate(token);
        const group = this.requireGroup(name);
        const isMember = actor.user.groups.some((g) => eq(g, group.name));
        if (!isMember) this.requirePermission(actor.user, 'groups:read');
        return this.users.filter((u) => u.groups.some((g) => eq(g, group.name))).map((u) => ({ ...u }));
    }

    async createGroup(
        token: string,
        input: { name: string; description?: string; permissions?: string[] },
    ): Promise<ICliGroup> {
        const actor = this.authenticate(token);
        this.requirePermission(actor.user, 'groups:create');
        const name = assertName(input.name, 'group name');
        if (this.findGroup(name)) throw new CliUsersError(409, `group already exists: ${name}`);
        assertText(input.description, 'description', 256);
        const permissions = assertPermissions(input.permissions) ?? [];
        this.requireCanGrant(actor.user, permissions);
        const now = Date.now();
        const group = {
            id: name,
            name,
            ...(input.description ? { description: input.description } : {}),
            permissions: cliMergePermissions(permissions),
            builtIn: false,
            createdAt: now,
            updatedAt: now,
        } as ICliGroup;
        this.groups.push(group);
        await this.persist('groups');
        await this.log('group_created', actor.user.name, name, actor.user.name);
        return { ...group };
    }

    async updateGroup(
        token: string,
        name: string,
        updates: { description?: string; permissions?: string[] },
    ): Promise<ICliGroup> {
        const actor = this.authenticate(token);
        this.requirePermission(actor.user, 'groups:update');
        const group = this.requireGroup(name);
        // Changing a group affects all its members: the caller must cover what it grants today
        this.requireCanGrant(actor.user, group.permissions ?? []);
        if (updates.permissions !== undefined) {
            if (eq(group.name, 'admin')) throw new CliUsersError(409, 'the admin group permissions cannot be changed');
            const permissions = assertPermissions(updates.permissions)!;
            this.requireCanGrant(actor.user, permissions);
            group.permissions = cliMergePermissions(permissions);
        }
        if (updates.description !== undefined) group.description = assertText(updates.description, 'description', 256);
        (group as any).updatedAt = Date.now();
        await this.persist('groups');
        await this.log('group_updated', actor.user.name, group.name, actor.user.name);
        return { ...group, permissions: [...(group.permissions ?? [])] };
    }

    async deleteGroup(token: string, name: string): Promise<void> {
        const actor = this.authenticate(token);
        this.requirePermission(actor.user, 'groups:delete');
        const group = this.requireGroup(name);
        if ((group as any).builtIn) throw new CliUsersError(409, `cannot delete built-in group: ${group.name}`);
        this.requireCanGrant(actor.user, group.permissions ?? []);
        this.groups = this.groups.filter((g) => g !== group);
        for (const user of this.users) {
            if (user.groups.some((g) => eq(g, group.name))) {
                user.groups = user.groups.filter((g) => !eq(g, group.name));
                user.updatedAt = Date.now();
            }
        }
        await this.persist('groups', 'users');
        await this.log('group_deleted', actor.user.name, group.name, actor.user.name);
    }

    async addGroupMember(token: string, groupName: string, userName: string): Promise<void> {
        const actor = this.authenticate(token);
        this.requirePermission(actor.user, 'groups:update');
        const group = this.findGroup(groupName);
        if (!group) throw new CliUsersError(400, `unknown group: ${groupName}`);
        const user = this.requireUser(userName);
        this.requireCanGrant(actor.user, group.permissions ?? []);
        if (!user.groups.some((g) => eq(g, group.name))) {
            user.groups = [...user.groups, group.name];
            user.updatedAt = Date.now();
            await this.persist('users');
        }
        await this.log('group_member_added', user.name, group.name, actor.user.name);
    }

    async removeGroupMember(token: string, groupName: string, userName: string): Promise<void> {
        const actor = this.authenticate(token);
        this.requirePermission(actor.user, 'groups:update');
        const group = this.requireGroup(groupName);
        const user = this.requireUser(userName);
        this.requireCanGrant(actor.user, group.permissions ?? []);
        this.requireCovers(actor.user, user);
        if (eq(group.name, 'admin') && this.isLastAdmin(user)) {
            throw new CliUsersError(409, 'cannot remove the last administrator from the admin group');
        }
        if (user.groups.some((g) => eq(g, group.name))) {
            user.groups = user.groups.filter((g) => !eq(g, group.name));
            user.updatedAt = Date.now();
            await this.persist('users');
        }
        await this.log('group_member_removed', user.name, group.name, actor.user.name);
    }

    // ── audit ────────────────────────────────────────────────────────

    async listAudit(
        token: string,
        options: { limit?: number; event?: string; username?: string } = {},
    ): Promise<ICliAuditEntry[]> {
        const actor = this.authenticate(token);
        this.requirePermission(actor.user, 'audit:read');
        let entries = [...this.audit];
        if (options.event) entries = entries.filter((e) => e.event === options.event);
        if (options.username) entries = entries.filter((e) => eq(e.username, options.username));
        entries.reverse(); // newest first
        return options.limit ? entries.slice(0, options.limit) : entries;
    }

    async clearAudit(token: string): Promise<void> {
        const actor = this.authenticate(token);
        this.requirePermission(actor.user, 'audit:clear');
        this.audit = [];
        await this.log('audit_cleared', actor.user.name, undefined, actor.user.name);
    }

    // ── bootstrap helpers (no actor) ─────────────────────────────────

    hasUsers(): boolean {
        return this.users.length > 0;
    }

    findUserPublic(idOrName: string): ICliUser | undefined {
        const user = this.findUser(idOrName);
        return user ? { ...user } : undefined;
    }

    /** Set a password without an actor (seeding / first-run). */
    async setPasswordInternal(idOrName: string, password: string): Promise<void> {
        const user = this.requireUser(idOrName);
        this.assertPasswordPolicy(password);
        await this.storeCredentials(user.id, password);
        await this.persist('credentials');
    }

    /**
     * Start a session without a password (boot auto-login, first-run wizard).
     * Not reachable through {@link ICliUsersBackend}; the module calls it directly.
     */
    async startTrustedSession(idOrName: string, details = 'auto-login'): Promise<CliBackendLogin> {
        const user = this.requireUser(idOrName);
        if (user.disabled) throw new CliUsersError(403, 'account disabled');
        const now = Date.now();
        user.lastLoginAt = now;
        const session: LocalSession = {
            id: randomId(),
            token: randomToken(),
            userId: user.id,
            createdAt: now,
            lastActivity: now,
        };
        this.sessions.push(session);
        await this.persist('users', 'sessions');
        await this.log('login', user.name, details);
        return { token: session.token, session: this.toBackendSession(session, user) };
    }

    /** Append an entry logged by an extension through `ICliAuditService.log`. */
    async appendAudit(entry: Omit<ICliAuditEntry, 'timestamp'>): Promise<void> {
        await this.log(entry.event, entry.username, entry.details, entry.actor);
    }

    /** First enabled member of the admin group (passwordless boot). */
    firstAdmin(): ICliUser | undefined {
        const admin = this.users.find((u) => !u.disabled && this.isAdmin(u));
        return admin ? { ...admin } : undefined;
    }

    // ── internals ────────────────────────────────────────────────────

    private authenticate(token: string, allowPasswordChange = false): { session: LocalSession; user: ICliUser } {
        const session = token ? this.sessions.find((s) => s.token === token) : undefined;
        if (!session) throw new CliUsersError(401, 'not authenticated');
        if (this.isExpired(session)) {
            this.sessions = this.sessions.filter((s) => s !== session);
            void this.persist('sessions');
            throw new CliUsersError(401, 'session expired');
        }
        const user = this.findUserById(session.userId);
        if (!user || user.disabled) {
            this.sessions = this.sessions.filter((s) => s !== session);
            void this.persist('sessions');
            throw new CliUsersError(401, 'not authenticated');
        }
        session.lastActivity = Date.now();
        if ((user as any).mustChangePassword && !allowPasswordChange) {
            throw new CliUsersError(403, 'password change required');
        }
        return { session, user };
    }

    private isExpired(session: LocalSession): boolean {
        const now = Date.now();
        const timeout = this.options.sessionTimeoutMs ?? 0;
        const lifetime = this.options.maxSessionLifetimeMs ?? DEFAULT_MAX_SESSION_LIFETIME;
        return (timeout > 0 && session.lastActivity + timeout < now) || (lifetime > 0 && session.createdAt + lifetime < now);
    }

    private expiresAt(session: LocalSession): number | undefined {
        const timeout = this.options.sessionTimeoutMs ?? 0;
        const lifetime = this.options.maxSessionLifetimeMs ?? DEFAULT_MAX_SESSION_LIFETIME;
        const candidates = [
            timeout > 0 ? session.lastActivity + timeout : undefined,
            lifetime > 0 ? session.createdAt + lifetime : undefined,
        ].filter((x): x is number => x !== undefined);
        return candidates.length ? Math.min(...candidates) : undefined;
    }

    /** B3: the caller must hold every permission the target holds */
    private requireCovers(actor: ICliUser, target: ICliUser): void {
        if (actor.id === target.id) return;
        if (!covers(this.effectivePermissions(actor), this.effectivePermissions(target))) {
            throw new CliUsersError(403, 'insufficient privileges for this user');
        }
    }

    /** B3: the caller can only hand out permissions they hold */
    private requireCanGrant(actor: ICliUser, permissions: string[]): void {
        const held = this.effectivePermissions(actor);
        const missing = permissions.filter((p) => !covers(held, [p]));
        if (missing.length) {
            throw new CliUsersError(403, `cannot grant permissions you do not hold: ${missing.join(', ')}`);
        }
    }

    /** B3: adding someone to groups hands out those groups' permissions */
    private requireCanAssignGroups(actor: ICliUser, groupNames: string[]): void {
        for (const name of groupNames) {
            this.requireCanGrant(actor, this.findGroup(name)?.permissions ?? []);
        }
    }

    private pruneExpiredSessions(): void {
        this.sessions = this.sessions.filter((s) => !this.isExpired(s) && this.findUserById(s.userId));
    }

    private requirePermission(user: ICliUser, permission: string): void {
        if (!cliHasPermission(this.effectivePermissions(user), permission)) {
            throw new CliUsersError(403, `permission denied (requires ${permission})`);
        }
    }

    effectivePermissions(user: ICliUser): string[] {
        return cliMergePermissions(
            ...user.groups.map((g) => this.findGroup(g)?.permissions),
        );
    }

    private isAdmin(user: ICliUser): boolean {
        return user.groups.some((g) => eq(g, 'admin'));
    }

    private isLastAdmin(user: ICliUser): boolean {
        if (!this.isAdmin(user) || user.disabled) return false;
        return !this.users.some((u) => u.id !== user.id && !u.disabled && this.isAdmin(u));
    }

    private normalizeGroups(groups: string[]): string[] {
        const out: string[] = [];
        for (const raw of groups) {
            const name = raw?.trim();
            if (!name) continue;
            const group = this.findGroup(name);
            if (!group) throw new CliUsersError(400, `unknown group: ${name}`);
            if (!out.some((g) => eq(g, group.name))) out.push(group.name);
        }
        return out;
    }

    private findUser(idOrName: string): ICliUser | undefined {
        if (!idOrName) return undefined;
        return (
            this.users.find((u) => u.id === idOrName) ??
            this.users.find((u) => eq(u.name, idOrName)) ??
            this.users.find((u) => eq(u.email, idOrName))
        );
    }

    private findUserById(id: string): ICliUser | undefined {
        return this.users.find((u) => u.id === id);
    }

    private requireUser(idOrName: string): ICliUser {
        const user = this.findUser(idOrName);
        if (!user) throw new CliUsersError(404, `user not found: ${idOrName}`);
        return user;
    }

    private findGroup(name: string): ICliGroup | undefined {
        return this.groups.find((g) => eq(g.name, name) || g.id === name);
    }

    private requireGroup(name: string): ICliGroup {
        const group = this.findGroup(name);
        if (!group) throw new CliUsersError(404, `group not found: ${name}`);
        return group;
    }

    private assertPasswordPolicy(password: string): void {
        if (!password) throw new CliUsersError(400, 'password is required');
        const error = this.options.validatePassword?.(password);
        if (error) throw new CliUsersError(400, error);
    }

    private async storeCredentials(userId: string, password: string): Promise<void> {
        const stored = await hashPassword(password, this.options.hashIterations);
        const cred: ICliUserCredentials = {
            userId,
            passwordHash: stored,
            salt: '',
            lastChanged: Date.now(),
        };
        const index = this.credentials.findIndex((c) => c.userId === userId);
        if (index >= 0) this.credentials[index] = cred;
        else this.credentials.push(cred);
    }

    private async checkPassword(userId: string, password: string): Promise<boolean> {
        const cred = this.credentials.find((c) => c.userId === userId);
        if (!cred) return false;
        const { valid, needsRehash } = await verifyPasswordHash(password, cred.passwordHash, cred.salt);
        if (valid && needsRehash) {
            await this.storeCredentials(userId, password);
            await this.persist('credentials');
        }
        return valid;
    }

    private assertNotLocked(key: string): void {
        const attempt = this.attempts[key];
        if (attempt && attempt.lockedUntil > Date.now()) {
            throw new CliUsersError(429, 'account locked, try again later');
        }
    }

    private recordFailure(key: string): void {
        const max = this.options.maxLoginAttempts ?? 5;
        if (max <= 0) return;
        const attempt = this.attempts[key] ?? { count: 0, lockedUntil: 0 };
        attempt.count++;
        if (attempt.count >= max) {
            attempt.lockedUntil = Date.now() + (this.options.lockoutMs ?? 5 * 60_000);
            attempt.count = 0;
        }
        this.attempts[key] = attempt;
        void this.persist('attempts');
    }

    private async revokeSessions(targets: LocalSession[], reason: string, actorName?: string): Promise<void> {
        if (!targets.length) return;
        const ids = new Set(targets.map((s) => s.id));
        this.sessions = this.sessions.filter((s) => !ids.has(s.id));
        await this.persist('sessions');
        for (const session of targets) {
            const user = this.findUserById(session.userId);
            await this.log('session_revoked', user?.name ?? session.userId, reason, actorName);
            this.options.onSessionRevoked?.({ sessionId: session.id, userId: session.userId, reason });
        }
    }

    private toBackendSession(session: LocalSession, user: ICliUser): CliBackendSession {
        const expiresAt = this.expiresAt(session);
        return {
            id: session.id,
            user: { ...user },
            permissions: this.effectivePermissions(user),
            loginTime: session.createdAt,
            lastActivity: session.lastActivity,
            ...(expiresAt ? { expiresAt } : {}),
        };
    }

    private toSessionInfo(session: LocalSession, current: boolean): ICliSessionInfo {
        const expiresAt = this.expiresAt(session);
        const user = this.findUserById(session.userId);
        return {
            id: session.id,
            userId: session.userId,
            userName: user?.name ?? session.userId,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            ...(expiresAt ? { expiresAt } : {}),
            current,
            metadata: { ...(session.metadata ?? {}) },
        };
    }

    private async log(
        event: string,
        username: string,
        details?: string,
        actor?: ICliUser | string,
        subject?: ICliUser,
    ): Promise<void> {
        const actorUser = typeof actor === 'string' ? this.findUser(actor) : actor;
        const actorName = typeof actor === 'string' ? actor : actor?.name;
        const subjectUser = subject ?? (details === 'unknown user' ? undefined : this.findUser(username));
        this.audit.push({
            id: randomId(),
            timestamp: Date.now(),
            event,
            username: sanitizeForAudit(username),
            ...(subjectUser ? { userId: subjectUser.id } : {}),
            ...(details ? { details: sanitizeForAudit(details, 256) } : {}),
            ...(actorName && actorName !== username ? { actor: actorName } : {}),
            ...(actorUser && actorUser.id !== subjectUser?.id ? { actorId: actorUser.id } : {}),
        } as ICliAuditEntry);
        // Failed logins are capped separately so they cannot flush other history
        const failed = this.audit.filter((e) => e.event === 'login_failed');
        if (failed.length > MAX_FAILED_LOGIN_ENTRIES) {
            const drop = new Set(failed.slice(0, failed.length - MAX_FAILED_LOGIN_ENTRIES));
            this.audit = this.audit.filter((e) => !drop.has(e));
        }
        const others = this.audit.filter((e) => e.event !== 'login_failed');
        if (others.length > MAX_AUDIT_ENTRIES) {
            const drop = new Set(others.slice(0, others.length - MAX_AUDIT_ENTRIES));
            this.audit = this.audit.filter((e) => !drop.has(e));
        }
        await this.persist('audit');
    }

    private async persist(...what: Array<keyof typeof LOCAL_KEYS>): Promise<void> {
        for (const key of new Set(what)) {
            await this.kv.set(LOCAL_KEYS[key], (this as any)[key]);
        }
    }
}

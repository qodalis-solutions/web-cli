import {
    ICliAuditEntry,
    ICliGroup,
    ICliHttpClient,
    ICliSessionInfo,
    ICliUser,
} from '@qodalis/cli-core';
import {
    CliBackendCreateUser,
    CliBackendLogin,
    CliBackendSession,
    CliBackendUpdateUser,
    CliBackendUserPermissions,
    CliUsersError,
    ICliUsersBackend,
} from './users-backend';

/**
 * {@link ICliUsersBackend} over HTTP: a CLI server users plugin
 * (node, python or .NET) at `<server>/api/v1/qcli`.
 */
export class CliHttpUsersBackend implements ICliUsersBackend {
    readonly kind = 'server' as const;

    constructor(
        /** e.g. `http://localhost:8047/api/v1/qcli` */
        readonly baseUrl: string,
        private readonly http: ICliHttpClient,
    ) {}

    // ── sessions / auth ──────────────────────────────────────────────

    login(username: string, password: string | undefined): Promise<CliBackendLogin> {
        if (password === undefined) {
            return Promise.reject(new CliUsersError(400, 'password is required'));
        }
        return this.call('POST', '/sessions', undefined, { username, password });
    }

    async logout(token: string): Promise<void> {
        await this.call('DELETE', '/sessions/current', token);
    }

    currentSession(token: string): Promise<CliBackendSession> {
        return this.call('GET', '/sessions/current', token);
    }

    listSessions(token: string): Promise<ICliSessionInfo[]> {
        return this.call('GET', '/sessions', token);
    }

    async revokeSession(token: string, sessionId: string): Promise<void> {
        await this.call('DELETE', `/sessions/${enc(sessionId)}`, token);
    }

    createWebSocketTicket(token: string): Promise<{ ticket: string; expiresIn: number }> {
        return this.call('POST', '/sessions/ws-ticket', token, {});
    }

    // ── users ────────────────────────────────────────────────────────

    listUsers(token: string, options: { query?: string; skip?: number; take?: number } = {}): Promise<ICliUser[]> {
        const params = new URLSearchParams();
        if (options.query) params.set('query', options.query);
        if (options.skip != null) params.set('skip', String(options.skip));
        if (options.take != null) params.set('take', String(options.take));
        const qs = params.toString();
        return this.call('GET', `/users${qs ? `?${qs}` : ''}`, token);
    }

    async getUser(token: string, idOrName: string): Promise<ICliUser | undefined> {
        try {
            return await this.call<ICliUser>('GET', `/users/${enc(idOrName)}`, token);
        } catch (e) {
            if (e instanceof CliUsersError && e.status === 404) return undefined;
            throw e;
        }
    }

    getUserPermissions(token: string, idOrName: string): Promise<CliBackendUserPermissions> {
        return this.call('GET', `/users/${enc(idOrName)}/permissions`, token);
    }

    createUser(token: string, user: CliBackendCreateUser): Promise<ICliUser> {
        return this.call('POST', '/users', token, user);
    }

    updateUser(token: string, idOrName: string, updates: CliBackendUpdateUser): Promise<ICliUser> {
        // lastLoginAt is server-managed
        const { lastLoginAt: _ignored, ...body } = updates;
        return this.call('PUT', `/users/${enc(idOrName)}`, token, body);
    }

    async deleteUser(token: string, idOrName: string): Promise<void> {
        await this.call('DELETE', `/users/${enc(idOrName)}`, token);
    }

    async setPassword(
        token: string,
        idOrName: string,
        password: string,
        currentPassword?: string,
        options: { temporary?: boolean } = {},
    ): Promise<void> {
        await this.call('PUT', `/users/${enc(idOrName)}/password`, token, {
            password,
            ...(currentPassword !== undefined ? { currentPassword } : {}),
            ...(options.temporary !== undefined ? { temporary: options.temporary } : {}),
        });
    }

    async verifyPassword(token: string, idOrName: string, password: string): Promise<boolean> {
        const result = await this.call<{ valid: boolean }>(
            'POST',
            `/users/${enc(idOrName)}/verify-password`,
            token,
            { password },
        );
        return !!result?.valid;
    }

    // ── groups ───────────────────────────────────────────────────────

    listGroups(token: string): Promise<ICliGroup[]> {
        return this.call('GET', '/groups', token);
    }

    async getGroup(token: string, name: string): Promise<ICliGroup | undefined> {
        try {
            return await this.call<ICliGroup>('GET', `/groups/${enc(name)}`, token);
        } catch (e) {
            if (e instanceof CliUsersError && e.status === 404) return undefined;
            throw e;
        }
    }

    getGroupMembers(token: string, name: string): Promise<ICliUser[]> {
        return this.call('GET', `/groups/${enc(name)}/members`, token);
    }

    createGroup(token: string, group: { name: string; description?: string; permissions?: string[] }): Promise<ICliGroup> {
        return this.call('POST', '/groups', token, group);
    }

    updateGroup(token: string, name: string, updates: { description?: string; permissions?: string[] }): Promise<ICliGroup> {
        return this.call('PUT', `/groups/${enc(name)}`, token, updates);
    }

    async deleteGroup(token: string, name: string): Promise<void> {
        await this.call('DELETE', `/groups/${enc(name)}`, token);
    }

    async addGroupMember(token: string, group: string, user: string): Promise<void> {
        await this.call('POST', `/groups/${enc(group)}/members/${enc(user)}`, token);
    }

    async removeGroupMember(token: string, group: string, user: string): Promise<void> {
        await this.call('DELETE', `/groups/${enc(group)}/members/${enc(user)}`, token);
    }

    // ── audit ────────────────────────────────────────────────────────

    listAudit(token: string, options: { limit?: number; event?: string; username?: string } = {}): Promise<ICliAuditEntry[]> {
        const params = new URLSearchParams();
        if (options.limit != null) params.set('limit', String(options.limit));
        if (options.event) params.set('event', options.event);
        if (options.username) params.set('username', options.username);
        const qs = params.toString();
        return this.call('GET', `/audit${qs ? `?${qs}` : ''}`, token);
    }

    async clearAudit(token: string): Promise<void> {
        await this.call('DELETE', '/audit', token);
    }

    // ── transport ────────────────────────────────────────────────────

    private async call<T = any>(method: string, path: string, token?: string, body?: unknown): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        let result: unknown;
        try {
            switch (method) {
                case 'GET':
                    result = await this.http.get<T>(url, { headers });
                    break;
                case 'POST':
                    result = await this.http.post<T>(url, body ?? {}, { headers });
                    break;
                case 'PUT':
                    result = await this.http.put<T>(url, body ?? {}, { headers });
                    break;
                case 'DELETE':
                    result = await this.http.delete<T>(url, { headers });
                    break;
                default:
                    throw new Error(`unsupported method ${method}`);
            }
        } catch (e) {
            throw toUsersError(e);
        }
        // Server data is printed to the terminal: never let it carry escape sequences
        return stripControlChars(result) as T;
    }
}

/** Encode a path segment; `.` and `..` are rejected so they cannot change the route */
const enc = (segment: string): string => {
    if (segment === '.' || segment === '..' || !segment) {
        throw new CliUsersError(400, `invalid name: '${segment}'`);
    }
    return encodeURIComponent(segment);
};

/** Remove C0/C1 control characters (incl. ESC) from every string in a JSON value. */
export function stripControlChars<T>(value: T): T {
    if (typeof value === 'string') {
        return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '') as unknown as T;
    }
    if (Array.isArray(value)) return value.map(stripControlChars) as unknown as T;
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = stripControlChars(v);
        return out as T;
    }
    return value;
}

/** Convert an HTTP failure into a {@link CliUsersError} with the server's message. */
export function toUsersError(e: unknown): Error {
    if (e instanceof CliUsersError) return e;
    const status = (e as { status?: unknown })?.status;
    if (typeof status === 'number') {
        const body = (e as { body?: unknown }).body;
        let message: string | undefined;
        if (body && typeof body === 'object') {
            message = (body as any).error ?? (body as any).detail ?? (body as any).message;
        } else if (typeof body === 'string' && body.trim()) {
            try {
                const parsed = JSON.parse(body);
                message = parsed.error ?? parsed.detail ?? parsed.message;
            } catch {
                message = body;
            }
        }
        const err = new CliUsersError(
            status,
            typeof message === 'string' ? stripControlChars(message).slice(0, 500) : `request failed (${status})`,
        );
        (err as any).cause = e;
        return err;
    }
    return new CliUsersError(0, `server unreachable: ${(e as Error)?.message ?? e}`);
}

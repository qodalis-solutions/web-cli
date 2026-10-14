/**
 * Example 19 — Integrating your own system (custom users backend)
 *
 * The users module is the CLI front end for a system's users. Two ways to
 * connect it:
 *   1. Install a Qodalis CLI server users plugin (node / python / .NET) next
 *      to your app and point `server` at it (example 21), optionally with
 *      custom stores or an auth adapter on the server side.
 *   2. Implement `ICliUsersBackend` against your existing API (this example).
 *
 * Every built-in command (whoami, id, perms, listusers, groups, ...), the
 * access guards and other extensions then run against your system. Your API
 * stays the authority: it must check permissions itself.
 *
 * Unsupported operations simply throw `CliUsersError(501, ...)`, which the
 * commands print as one clean line.
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/plugins/users
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import { ICliAuditEntry, ICliGroup, ICliSessionInfo, ICliUser } from '@qodalis/cli-core';
import {
    CliBackendLogin,
    CliBackendSession,
    CliBackendUserPermissions,
    CliUsersError,
    ICliUsersBackend,
    usersModule,
} from '@qodalis/cli-users';

/** Shape of the (fictional) host API */
interface HostUser {
    id: string;
    login: string;
    mail: string;
    roles: string[];
    scopes: string[];
}

const API = 'https://app.example.com/api';

const toCliUser = (u: HostUser): ICliUser => ({
    id: u.id,
    name: u.login,
    email: u.mail,
    groups: u.roles,
    disabled: false,
    createdAt: 0,
    updatedAt: 0,
});

class HostSystemBackend implements ICliUsersBackend {
    readonly kind = 'server' as const;

    private async call<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
        const res = await fetch(API + path, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new CliUsersError(res.status, body.message ?? res.statusText);
        }
        return res.status === 204 ? (undefined as T) : res.json();
    }

    private toSession(id: string, u: HostUser): CliBackendSession {
        return { id, user: toCliUser(u), permissions: u.scopes, loginTime: Date.now(), lastActivity: Date.now() };
    }

    async login(username: string, password?: string): Promise<CliBackendLogin> {
        const r = await this.call<{ accessToken: string; sessionId: string; user: HostUser }>('/auth/token', undefined, {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
        return { token: r.accessToken, session: this.toSession(r.sessionId, r.user) };
    }
    async logout(token: string) {
        await this.call('/auth/token', token, { method: 'DELETE' });
    }
    async currentSession(token: string) {
        const r = await this.call<{ sessionId: string; user: HostUser }>('/me', token);
        return this.toSession(r.sessionId, r.user);
    }
    async listUsers(token: string, options?: { query?: string }) {
        const list = await this.call<HostUser[]>(`/users?search=${encodeURIComponent(options?.query ?? '')}`, token);
        return list.map(toCliUser);
    }
    async getUser(token: string, idOrName: string) {
        return toCliUser(await this.call<HostUser>(`/users/${encodeURIComponent(idOrName)}`, token));
    }
    async getUserPermissions(token: string, idOrName: string): Promise<CliBackendUserPermissions> {
        const u = await this.call<HostUser>(`/users/${encodeURIComponent(idOrName)}`, token);
        return { userId: u.id, groups: u.roles, permissions: u.scopes };
    }
    async listGroups(token: string): Promise<ICliGroup[]> {
        const roles = await this.call<Array<{ name: string; scopes: string[] }>>('/roles', token);
        return roles.map((r) => ({ id: r.name, name: r.name, permissions: r.scopes, createdAt: 0 }));
    }
    async getGroup(token: string, name: string) {
        return (await this.listGroups(token)).find((g) => g.name === name);
    }

    // Operations the host manages elsewhere
    private unsupported(): never {
        throw new CliUsersError(501, 'managed in the admin console at https://app.example.com/admin');
    }
    listSessions(): Promise<ICliSessionInfo[]> { return this.unsupported(); }
    revokeSession(): Promise<void> { return this.unsupported(); }
    createUser(): Promise<ICliUser> { return this.unsupported(); }
    updateUser(): Promise<ICliUser> { return this.unsupported(); }
    deleteUser(): Promise<void> { return this.unsupported(); }
    setPassword(): Promise<void> { return this.unsupported(); }
    verifyPassword(): Promise<boolean> { return this.unsupported(); }
    getGroupMembers(): Promise<ICliUser[]> { return this.unsupported(); }
    createGroup(): Promise<ICliGroup> { return this.unsupported(); }
    updateGroup(): Promise<ICliGroup> { return this.unsupported(); }
    deleteGroup(): Promise<void> { return this.unsupported(); }
    addGroupMember(): Promise<void> { return this.unsupported(); }
    removeGroupMember(): Promise<void> { return this.unsupported(); }
    listAudit(): Promise<ICliAuditEntry[]> { return this.unsupported(); }
    clearAudit(): Promise<void> { return this.unsupported(); }
}

const engine = new CliEngine(document.getElementById('terminal')!);
engine.registerModules([
    usersModule.configure({
        backend: new HostSystemBackend(),
        requirePassword: true,
        persistToken: false, // keep the host token in memory only
    }),
]);
engine.start().then(() => engine.focus());

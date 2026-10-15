import { CliUsersError } from '../lib/backend/users-backend';
import { hashPassword } from '../lib/backend/password-hashing';
import { localBackend, MemoryKv } from './helpers';

async function expectStatus(promise: Promise<unknown>, status: number, message?: string | RegExp): Promise<void> {
    try {
        await promise;
        fail(`expected ${status}`);
    } catch (e: any) {
        expect(e instanceof CliUsersError).withContext(String(e)).toBeTrue();
        expect(e.status).withContext(e.message).toBe(status);
        if (message) expect(e.message).toMatch(message);
    }
}

describe('CliLocalUsersBackend (users contract, local)', () => {
    describe('built-ins and seeding', () => {
        it('seeds admin (*) and users groups as built-in', async () => {
            const { backend, root } = await localBackend();
            const groups = await backend.listGroups(root);
            const admin = groups.find((g) => g.name === 'admin')!;
            const users = groups.find((g) => g.name === 'users')!;
            expect(admin.permissions).toEqual(['*']);
            expect(admin.builtIn).toBeTrue();
            expect(users.permissions).toEqual(['commands:execute']);
            expect(users.builtIn).toBeTrue();
        });

        it('gives new users the "users" group by default', async () => {
            const { backend, root } = await localBackend();
            const u = await backend.createUser(root, { name: 'alice', email: 'a@x.io', password: 'pw' });
            expect(u.groups).toEqual(['users']);
            expect(u.disabled).toBeFalse();
        });

        it('migrates groups stored without permissions', async () => {
            const kv = new MemoryKv();
            await kv.set('cli-groups', [{ id: 'admin', name: 'admin', createdAt: 1 }, { id: 'dev', name: 'dev', createdAt: 1 }]);
            const { backend, root } = await localBackend({}, kv);
            const groups = await backend.listGroups(root);
            expect(groups.find((g) => g.name === 'admin')!.permissions).toEqual(['*']);
            expect(groups.find((g) => g.name === 'dev')!.permissions).toEqual([]);
        });
    });

    describe('login', () => {
        it('logs in by name or email, returns token and permissions', async () => {
            const { backend } = await localBackend();
            const byEmail = await backend.login('root@localhost', 'root');
            expect(byEmail.token).toBeTruthy();
            expect(byEmail.session.permissions).toEqual(['*']);
            expect(byEmail.session.user.lastLoginAt).toBeGreaterThan(0);
        });

        it('rejects bad credentials with 401 and unknown users the same way', async () => {
            const { backend } = await localBackend();
            await expectStatus(backend.login('root', 'nope'), 401, /invalid credentials/);
            await expectStatus(backend.login('ghost', 'x'), 401, /invalid credentials/);
        });

        it('locks the account after repeated failures (429), by name or email', async () => {
            const { backend } = await localBackend({ maxLoginAttempts: 3 });
            for (let i = 0; i < 3; i++) await expectStatus(backend.login('root', 'bad'), 401);
            await expectStatus(backend.login('root', 'root'), 429);
            await expectStatus(backend.login('root@localhost', 'root'), 429);
        });

        it('refuses disabled accounts with 403 (after a correct password)', async () => {
            const { backend, root } = await localBackend();
            await backend.createUser(root, { name: 'bob', email: 'b@x.io', password: 'pw', disabled: true });
            await expectStatus(backend.login('bob', 'wrong'), 401);
            await expectStatus(backend.login('bob', 'pw'), 403, /disabled/);
        });

        it('only allows passwordless login when enabled', async () => {
            const closed = await localBackend();
            await expectStatus(closed.backend.login('root', undefined, { trusted: true }), 400);
            const open = await localBackend({ allowTrustedLogin: true });
            const result = await open.backend.login('root', undefined, { trusted: true });
            expect(result.session.user.name).toBe('root');
        });

        it('verifies legacy sha256 credentials and upgrades them', async () => {
            const kv = new MemoryKv();
            const { backend, root } = await localBackend({}, kv);
            const user = await backend.createUser(root, { name: 'old', email: 'o@x.io' });
            const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('salt' + 'legacy')));
            const hex = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
            const creds = (await kv.get<any[]>('cli-credentials'))!;
            creds.push({ userId: user.id, passwordHash: hex, salt: 'salt', lastChanged: 0 });
            await kv.set('cli-credentials', creds);
            const reloaded = await localBackend({}, kv);
            await reloaded.backend.login('old', 'legacy');
            const stored = (await kv.get<any[]>('cli-credentials'))!.find((c) => c.userId === user.id);
            expect(stored.passwordHash).toMatch(/^pbkdf2\$/);
        });
    });

    describe('sessions', () => {
        it('expires idle sessions and slides activity', async () => {
            const { backend } = await localBackend({ sessionTimeoutMs: 50 });
            const { token } = await backend.login('root', 'root');
            await new Promise((r) => setTimeout(r, 30));
            await backend.currentSession(token); // slides
            await new Promise((r) => setTimeout(r, 30));
            await backend.currentSession(token); // still valid
            await new Promise((r) => setTimeout(r, 80));
            await expectStatus(backend.currentSession(token), 401, /expired/);
        });

        it('lists sessions without tokens and marks the current one', async () => {
            const { backend, root } = await localBackend();
            const list = await backend.listSessions(root);
            expect(list.length).toBe(1);
            expect(list[0].current).toBeTrue();
            expect(JSON.stringify(list)).not.toContain(root);
        });

        it('revokes sessions and reports it', async () => {
            const revoked: any[] = [];
            const { backend, root } = await localBackend({ onSessionRevoked: (i) => revoked.push(i) });
            await backend.createUser(root, { name: 'alice', email: 'a@x.io', password: 'pw' });
            const alice = await backend.login('alice', 'pw');
            await backend.revokeSession(root, alice.session.id);
            expect(revoked[0].sessionId).toBe(alice.session.id);
            await expectStatus(backend.currentSession(alice.token), 401);
        });

        it('lets a user end their own session but not others without sessions:revoke', async () => {
            const { backend, root } = await localBackend();
            await backend.createUser(root, { name: 'alice', email: 'a@x.io', password: 'pw' });
            const alice = await backend.login('alice', 'pw');
            const rootSession = (await backend.currentSession(root)).id;
            await expectStatus(backend.revokeSession(alice.token, rootSession), 403);
            await backend.revokeSession(alice.token, alice.session.id);
        });
    });

    describe('permissions (roles)', () => {
        it('grants exactly what the groups grant', async () => {
            const { backend, root } = await localBackend();
            await backend.createGroup(root, { name: 'helpdesk', permissions: ['users:read', 'sessions:*'] });
            await backend.createUser(root, { name: 'hd', email: 'hd@x.io', password: 'pw', groups: ['helpdesk'] });
            const hd = (await backend.login('hd', 'pw')).token;

            expect((await backend.listUsers(hd)).length).toBe(2);
            expect((await backend.listSessions(hd)).length).toBe(2);
            await expectStatus(backend.createUser(hd, { name: 'x', email: 'x@x.io' }), 403, /users:create/);
            await expectStatus(backend.deleteUser(hd, 'root'), 403);
            await expectStatus(backend.listAudit(hd), 403);
            expect((await backend.getUserPermissions(hd, 'hd')).permissions).toEqual(['users:read', 'sessions:*']);
        });

        it('applies group changes to live sessions immediately', async () => {
            const { backend, root } = await localBackend();
            await backend.createGroup(root, { name: 'ops' });
            await backend.createUser(root, { name: 'op', email: 'op@x.io', password: 'pw', groups: ['ops'] });
            const op = (await backend.login('op', 'pw')).token;
            await expectStatus(backend.listAudit(op), 403);
            await backend.updateGroup(root, 'ops', { permissions: ['audit:read'] });
            expect(Array.isArray(await backend.listAudit(op))).toBeTrue();
            expect((await backend.currentSession(op)).permissions).toEqual(['audit:read']);
        });

        it('lets users read and edit their own profile (email/data only)', async () => {
            const { backend, root } = await localBackend();
            await backend.createUser(root, { name: 'alice', email: 'a@x.io', password: 'pw' });
            const alice = (await backend.login('alice', 'pw')).token;
            expect((await backend.getUser(alice, 'alice'))!.name).toBe('alice');
            await backend.updateUser(alice, 'alice', { email: 'new@x.io' });
            await expectStatus(backend.updateUser(alice, 'alice', { groups: ['admin'] }), 403);
            await expectStatus(backend.getUser(alice, 'root'), 403);
        });
    });

    describe('validation and protections', () => {
        it('rejects duplicates (409) on create and rename', async () => {
            const { backend, root } = await localBackend();
            await backend.createUser(root, { name: 'alice', email: 'a@x.io' });
            await backend.createUser(root, { name: 'bob', email: 'b@x.io' });
            await expectStatus(backend.createUser(root, { name: 'ALICE', email: 'z@x.io' }), 409);
            await expectStatus(backend.createUser(root, { name: 'z', email: 'A@x.io' }), 409);
            await expectStatus(backend.updateUser(root, 'bob', { name: 'alice' }), 409);
            await expectStatus(backend.updateUser(root, 'bob', { email: 'a@x.io' }), 409);
            await backend.updateUser(root, 'bob', { name: 'robert' });
            expect(await backend.getUser(root, 'robert')).toBeDefined();
        });

        it('requires referenced groups to exist (400)', async () => {
            const { backend, root } = await localBackend();
            await expectStatus(backend.createUser(root, { name: 'a', email: 'a@x.io', groups: ['nope'] }), 400, /unknown group/);
            await backend.createUser(root, { name: 'b', email: 'b@x.io' });
            await expectStatus(backend.addGroupMember(root, 'nope', 'b'), 400, /unknown group/);
        });

        it('protects yourself and the last administrator', async () => {
            const { backend, root } = await localBackend();
            await expectStatus(backend.deleteUser(root, 'root'), 409, /your own/);
            await expectStatus(backend.updateUser(root, 'root', { disabled: true }), 409);
            await expectStatus(backend.updateUser(root, 'root', { groups: ['users'] }), 409, /last administrator/);
            await expectStatus(backend.removeGroupMember(root, 'admin', 'root'), 409, /last administrator/);

            await backend.createUser(root, { name: 'admin2', email: 'a2@x.io', groups: ['admin'], password: 'pw' });
            await backend.removeGroupMember(root, 'admin', 'root'); // no longer the last
        });

        it('protects built-in groups and the admin permissions', async () => {
            const { backend, root } = await localBackend();
            await expectStatus(backend.deleteGroup(root, 'admin'), 409);
            await expectStatus(backend.deleteGroup(root, 'users'), 409);
            await expectStatus(backend.updateGroup(root, 'admin', { permissions: ['users:read'] }), 409);
            await backend.updateGroup(root, 'admin', { description: 'Admins' });
        });

        it('enforces the password policy', async () => {
            const { backend, root } = await localBackend({ validatePassword: (p) => (p.length < 4 ? 'too short' : null) });
            await expectStatus(backend.createUser(root, { name: 'a', email: 'a@x.io', password: 'abc' }), 400, /too short/);
            expect(await backend.getUser(root, 'a')).toBeUndefined();
        });
    });

    describe('cascades', () => {
        it('deleting a group removes it from members', async () => {
            const { backend, root } = await localBackend();
            await backend.createGroup(root, { name: 'dev' });
            await backend.createUser(root, { name: 'a', email: 'a@x.io', groups: ['dev', 'users'] });
            await backend.deleteGroup(root, 'dev');
            expect((await backend.getUser(root, 'a'))!.groups).toEqual(['users']);
            await backend.createGroup(root, { name: 'dev' }); // re-creating grants nothing back
            expect((await backend.getUser(root, 'a'))!.groups).toEqual(['users']);
        });

        it('deleting a user removes credentials and sessions', async () => {
            const { backend, root, kv } = await localBackend();
            const a = await backend.createUser(root, { name: 'a', email: 'a@x.io', password: 'pw' });
            const session = await backend.login('a', 'pw');
            await backend.deleteUser(root, 'a');
            expect((await kv.get<any[]>('cli-credentials'))!.some((c) => c.userId === a.id)).toBeFalse();
            await expectStatus(backend.currentSession(session.token), 401);
        });

        it('disabling a user ends their sessions', async () => {
            const { backend, root } = await localBackend();
            await backend.createUser(root, { name: 'a', email: 'a@x.io', password: 'pw' });
            const session = await backend.login('a', 'pw');
            await backend.updateUser(root, 'a', { disabled: true });
            await expectStatus(backend.currentSession(session.token), 401);
        });

        it('password changes: self keeps the current session, others lose all', async () => {
            const { backend, root } = await localBackend();
            await backend.createUser(root, { name: 'a', email: 'a@x.io', password: 'pw' });
            const s1 = await backend.login('a', 'pw');
            const s2 = await backend.login('a', 'pw');
            await expectStatus(backend.setPassword(s1.token, 'a', 'new', 'wrong'), 403);
            await expectStatus(backend.setPassword(s1.token, 'a', 'new'), 400);
            await backend.setPassword(s1.token, 'a', 'new', 'pw');
            await backend.currentSession(s1.token);
            await expectStatus(backend.currentSession(s2.token), 401);

            await backend.setPassword(root, 'a', 'reset');
            await expectStatus(backend.currentSession(s1.token), 401);
            await backend.login('a', 'reset');
        });
    });

    describe('audit', () => {
        it('records every security event with the actor, newest first', async () => {
            const { backend, root } = await localBackend();
            await backend.createGroup(root, { name: 'dev' });
            await backend.createUser(root, { name: 'a', email: 'a@x.io', password: 'pw' });
            await backend.addGroupMember(root, 'dev', 'a');
            await backend.updateUser(root, 'a', { disabled: true });
            await backend.deleteUser(root, 'a');
            const events = (await backend.listAudit(root)).map((e) => e.event);
            expect(events.slice(0, 6)).toEqual([
                'user_deleted', 'user_updated', 'user_disabled', 'group_member_added', 'user_created', 'group_created',
            ]);
            const created = (await backend.listAudit(root, { event: 'user_created' }))[0];
            expect(created.username).toBe('a');
            expect(created.actor).toBe('root');
        });

        it('clears with audit:clear and records the clear', async () => {
            const { backend, root } = await localBackend();
            await backend.clearAudit(root);
            const entries = await backend.listAudit(root);
            expect(entries.map((e) => e.event)).toEqual(['audit_cleared']);
        });
    });

    it('hashPassword uses the shared pbkdf2 format', async () => {
        expect(await hashPassword('x', 1000)).toMatch(/^pbkdf2\$1000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    });

    describe('security (no escalation, validation, forced password change)', () => {
        async function delegated(perms: string[]) {
            const ctx = await localBackend();
            await ctx.backend.createGroup(ctx.root, { name: 'delegates', permissions: perms });
            await ctx.backend.createUser(ctx.root, { name: 'del', email: 'del@x.io', password: 'pw', groups: ['users', 'delegates'] });
            const del = (await ctx.backend.login('del', 'pw')).token;
            return { ...ctx, del };
        }

        it('groups:update cannot join admin or grant *', async () => {
            const { backend, del } = await delegated(['groups:update', 'groups:create']);
            await expectStatus(backend.addGroupMember(del, 'admin', 'del'), 403, /cannot grant/);
            await expectStatus(backend.updateGroup(del, 'users', { permissions: ['*'] }), 403, /cannot grant/);
            await expectStatus(backend.updateGroup(del, 'delegates', { permissions: ['users:*'] }), 403);
            await expectStatus(backend.createGroup(del, { name: 'evil', permissions: ['*'] }), 403);
            await backend.createGroup(del, { name: 'ok', permissions: ['groups:update'] });
        });

        it('users:update / users:create cannot reach admin rights', async () => {
            const { backend, del } = await delegated(['users:update', 'users:create', 'users:read']);
            await expectStatus(backend.updateUser(del, 'del', { groups: ['admin'] }), 403);
            await expectStatus(backend.createUser(del, { name: 'x', email: 'x@x.io', groups: ['admin'], password: 'pw' }), 403);
            await expectStatus(backend.setPassword(del, 'root', 'hijacked'), 403, /insufficient privileges/);
            await expectStatus(backend.updateUser(del, 'root', { disabled: true }), 403);
            // can manage users with fewer rights
            await backend.createUser(del, { name: 'y', email: 'y@x.io', password: 'pw' });
            await backend.setPassword(del, 'y', 'reset-pass');
        });

        it('admin resets are temporary: the user must choose a new password', async () => {
            const { backend, root } = await localBackend();
            await backend.createUser(root, { name: 'a', email: 'a@x.io', password: 'pw' });
            await backend.setPassword(root, 'a', 'temp-pass');
            const s = await backend.login('a', 'temp-pass');
            expect(s.session.user.mustChangePassword).toBeTrue();
            await expectStatus(backend.listGroups(s.token), 403, /password change required/);
            await backend.currentSession(s.token);
            await backend.setPassword(s.token, 'a', 'mine-now', 'temp-pass');
            expect((await backend.currentSession(s.token)).user.mustChangePassword).toBeFalse();
            await backend.listGroups(s.token);
            await backend.setPassword(root, 'a', 'shared', undefined, { temporary: false });
            expect((await backend.login('a', 'shared')).session.user.mustChangePassword).toBeFalse();
        });

        it('validates names, emails and permissions', async () => {
            const { backend, root } = await localBackend();
            await expectStatus(backend.createUser(root, { name: 'evil\u001b[2J', email: 'e@x.io' }), 400, /invalid name/);
            await expectStatus(backend.createUser(root, { name: '..', email: 'e@x.io' }), 400);
            await expectStatus(backend.createUser(root, { name: 'e', email: 'not-an-email' }), 400, /invalid email/);
            await expectStatus(backend.createGroup(root, { name: 'g', permissions: ['bad perm!'] }), 400, /invalid permission/);
            await expectStatus(backend.createUser(root, { name: 'root@localhost', email: 'z@x.io' }), 409);
        });

        it('locks unknown names like known ones and sanitizes them in the audit log', async () => {
            const { backend, root } = await localBackend({ maxLoginAttempts: 2 });
            await expectStatus(backend.login('ghost\u001b]8;;x', 'a'), 401);
            await expectStatus(backend.login('ghost\u001b]8;;x', 'a'), 401);
            await expectStatus(backend.login('ghost\u001b]8;;x', 'a'), 429);
            const failed = await backend.listAudit(root, { event: 'login_failed' });
            expect(failed[0].username).not.toContain('\u001b');
        });

        it('caps failed-login entries separately', async () => {
            const { backend, root } = await localBackend({ maxLoginAttempts: 0 });
            await backend.createGroup(root, { name: 'keepme' });
            for (let i = 0; i < 205; i++) await backend.login(`nobody${i}`, 'x').catch(() => undefined);
            const all = await backend.listAudit(root);
            expect(all.filter((e) => e.event === 'login_failed').length).toBe(200);
            expect(all.some((e) => e.event === 'group_created')).toBeTrue();
        });

        it('records user and actor ids', async () => {
            const { backend, root } = await localBackend();
            const a = await backend.createUser(root, { name: 'a', email: 'a@x.io' });
            const entry = (await backend.listAudit(root, { event: 'user_created' }))[0];
            expect(entry.userId).toBe(a.id);
            expect(entry.actorId).toBeTruthy();
            expect(entry.id).toBeTruthy();
        });

        it('enforces an absolute session lifetime', async () => {
            const { backend } = await localBackend({ maxSessionLifetimeMs: 40 });
            const { token } = await backend.login('root', 'root');
            await new Promise((r) => setTimeout(r, 25));
            await backend.currentSession(token);
            await new Promise((r) => setTimeout(r, 25));
            await expectStatus(backend.currentSession(token), 401);
        });
    });

    describe('fixes', () => {
        it('concurrent logins cannot try more passwords than the lockout allows', async () => {
            const { backend } = await localBackend({ maxLoginAttempts: 5 });
            await backend.createUserInternal({ name: 'alice', email: 'alice@x.io', password: 'right-pw' });
            const check = spyOn(backend as any, 'checkPassword').and.callThrough();
            const guesses = Array.from({ length: 10 }, (_, i) => (i === 7 ? 'right-pw' : `wrong-${i}`));
            const results = await Promise.all(
                guesses.map((pw, i) =>
                    backend.login(i % 2 ? 'alice' : 'ALICE@x.io', pw).then(() => 200, (e: any) => e.status),
                ),
            );
            expect(check.calls.count()).toBe(5);
            expect(results.filter((s) => s === 401).length).toBe(5);
            expect(results.filter((s) => s === 429).length).toBe(5);
            expect(results).not.toContain(200);
        });

        it('extensions cannot write built-in audit events; custom ones record the caller', async () => {
            const { backend, root } = await localBackend();
            for (const event of ['login', 'LOGOUT', 'login_failed', 'su', 'user_created', 'group_deleted', 'session_revoked', 'password_changed', 'audit_cleared']) {
                await expectStatus(backend.appendAudit(event, 'root'), 400, /reserved/);
            }
            await backend.appendAudit('deploy', 'root', 'v1.2');
            const entry = (await backend.listAudit(root, { event: 'deploy' }))[0];
            expect(entry.username).toBe('root');
            expect(entry.details).toBe('v1.2');
        });
    });
});

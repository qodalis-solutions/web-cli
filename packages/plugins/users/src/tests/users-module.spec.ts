import {
    ICliAuthorizationService,
    ICliAuthorizationService_TOKEN,
    ICliHttpClient,
    ICliKeyValueStore_TOKEN,
    ICliServerAuthTokenProvider,
    ICliServerAuthTokenProvider_TOKEN,
    CliHttpError,
} from '@qodalis/cli-core';
import { CliServiceContainer } from '@qodalis/cli';
import { usersModule } from '../public-api';
import { CliUsersModuleConfig } from '../lib/models/users-module-config';
import { MemoryKv } from './helpers';
import { CliUserSessionService } from '../lib/services/cli-user-session.service';
import { CliUsersError } from '../lib/backend/users-backend';

interface FakeContext {
    ctx: any;
    out: string[];
    warnings: string[];
    errors: string[];
    prompts: number;
    emit(source: string, type: string, data: any): void;
}

function fakeContext(kv: MemoryKv, options: { http?: ICliHttpClient; answers?: any[] } = {}): FakeContext {
    const services = new CliServiceContainer();
    services.set({ provide: ICliKeyValueStore_TOKEN, useValue: kv });
    const handlers: Array<{ handler: (e: any) => void; filter: any }> = [];
    const answers = [...(options.answers ?? [])];
    const result: FakeContext = {
        out: [],
        warnings: [],
        errors: [],
        prompts: 0,
        ctx: undefined,
        emit(source, type, data) {
            handlers.filter((h) => h.filter.source === source && h.filter.type === type).forEach((h) => h.handler({ data }));
        },
    };
    result.ctx = {
        services,
        options: { servers: [{ name: 'node', url: 'http://srv' }] },
        http: options.http,
        userSession: undefined,
        writer: {
            writeln: (t = '') => result.out.push(t),
            write: (t: string) => result.out.push(t),
            writeInfo: (t: string) => result.out.push(t),
            writeSuccess: (t: string) => result.out.push(t),
            writeWarning: (t: string) => result.warnings.push(t),
            writeError: (t: string) => result.errors.push(t),
        },
        reader: {
            readLine: async () => answers.shift() ?? null,
            readPassword: async () => answers.shift() ?? null,
            readConfirm: async () => true,
        },
        showPrompt: () => result.prompts++,
        backgroundServices: {
            on: (handler: any, filter: any) => {
                const entry = { handler, filter };
                handlers.push(entry);
                return () => handlers.splice(handlers.indexOf(entry), 1);
            },
        },
    };
    return result;
}

const LOCAL: CliUsersModuleConfig = {
    passwordHashIterations: 1000,
    seedUsers: [{ name: 'root1', email: 'root1@x.io', groups: ['admin'] }],
    defaultPassword: 'root',
};
/** Passwordless development mode: the first admin is signed in at boot */
const DEV: CliUsersModuleConfig = { ...LOCAL, requirePassword: false };

async function boot(config: CliUsersModuleConfig, f: FakeContext) {
    const module: any = usersModule.configure(config);
    await module.onInit(f.ctx);
    return module;
}

describe('usersModule lifecycle', () => {
    let modules: any[] = [];
    const track = <T>(m: T): T => (modules.push(m), m);
    afterEach(async () => {
        for (const m of modules) await m.onDestroy?.();
        modules = [];
    });

    describe('local mode', () => {
        it('starts signed out by default (passwords required)', async () => {
            const f = fakeContext(new MemoryKv());
            const m = track(await boot(LOCAL, f));
            expect(f.ctx.userSession).toBeUndefined();
            expect(m._runtime.auth.passwordless).toBeFalse();
            await m._runtime.auth.login('root1', 'root');
            expect(f.ctx.userSession.user.name).toBe('root1');
        });

        it('passwordless dev mode signs in the first administrator and exposes authorization', async () => {
            const f = fakeContext(new MemoryKv());
            track(await boot(DEV, f));
            expect(f.ctx.userSession.user.name).toBe('root1');
            expect(f.ctx.userSession.permissions).toEqual(['*']);
            const auth = f.ctx.services.get(ICliAuthorizationService_TOKEN) as ICliAuthorizationService;
            expect(auth.can('anything:at-all')).toBeTrue();
            expect(auth.getPrincipal()!.name).toBe('root1');
        });

        it('stays signed out after logout, across reloads, until the next login', async () => {
            const kv = new MemoryKv();
            const f1 = fakeContext(kv);
            const m1 = track(await boot(DEV, f1));
            await m1._runtime.auth.logout();
            expect(f1.ctx.userSession).toBeUndefined();

            const f2 = fakeContext(kv);
            const m2 = track(await boot(DEV, f2));
            expect(f2.ctx.userSession).toBeUndefined();

            await m2._runtime.auth.login('root1', 'root');
            const f3 = fakeContext(kv);
            track(await boot(DEV, f3));
            expect(f3.ctx.userSession.user.name).toBe('root1'); // restored from token
        });

        it('requirePasswordOnBoot asks for credentials', async () => {
            const f = fakeContext(new MemoryKv(), { answers: ['root1', 'wrong', 'root1', 'root'] });
            const m = track(await boot({ ...LOCAL, requirePasswordOnBoot: true, requirePassword: true }, f));
            expect(f.ctx.userSession).toBeUndefined();
            await m.onAfterBoot(f.ctx);
            expect(f.ctx.userSession.user.name).toBe('root1');
            expect(f.errors[0]).toMatch(/invalid credentials/);
        });

        it('runs the first-run wizard when there are no accounts', async () => {
            // Each invalid answer is asked again on its own: name, email, password, then the confirmation.
            const f = fakeContext(new MemoryKv(), {
                answers: ['', 'alice', 'Alice L', 'alice@x.io', 'Alice Liddell', 'short', 'secret123', 'other123', 'secret123', 'secret123', ''],
            });
            const m = track(await boot({ passwordHashIterations: 1000 }, f));
            expect(f.ctx.userSession).toBeUndefined();
            await m.onSetup(f.ctx);
            expect(f.errors).toEqual([
                'Username is required.',
                'Invalid email format.',
                'Password must be at least 8 characters',
                'Passwords do not match.',
            ]);
            expect(f.ctx.userSession.user.email).toBe('alice@x.io');
            expect(f.ctx.userSession.user.data?.['fullName']).toBe('Alice Liddell');
            expect(f.ctx.userSession.user.name).toBe('alice');
            expect(f.ctx.userSession.user.groups).toEqual(['admin']);
            expect(f.ctx.userSession.user.homeDir).toBe('/home/alice');
            expect(m._runtime.local.findUserPublic('root')).toBeUndefined(); // no well-known account
        });

        it('an expired session never turns into an automatic admin sign-in', async () => {
            const kv = new MemoryKv();
            const f1 = fakeContext(kv);
            const m1 = track(await boot({ ...DEV, sessionTimeout: 30 }, f1));
            await new Promise((r) => setTimeout(r, 60));
            await m1._runtime.session.touch();
            expect(f1.ctx.userSession).toBeUndefined();
            await new Promise((r) => setTimeout(r));
            const f2 = fakeContext(kv);
            track(await boot({ ...DEV, sessionTimeout: 30 }, f2));
            expect(f2.ctx.userSession).toBeUndefined();
        });

        it('maxSessionLifetime ends a session that has lasted longer', async () => {
            const f = fakeContext(new MemoryKv());
            const m = track(await boot({ ...DEV, maxSessionLifetime: 30 }, f));
            expect(f.ctx.userSession).toBeDefined();
            await new Promise((r) => setTimeout(r, 60));
            await m._runtime.session.touch();
            expect(f.ctx.userSession).toBeUndefined();
        });

        it('maxSessionLifetime 0 keeps the session until sign-out', async () => {
            const f = fakeContext(new MemoryKv());
            const m = track(await boot({ ...DEV, maxSessionLifetime: 0 }, f));
            expect((m._runtime.local as any).options.maxSessionLifetimeMs).toBe(0);
            await new Promise((r) => setTimeout(r, 60));
            await m._runtime.session.touch();
            expect(f.ctx.userSession).toBeDefined();
        });

        it('seeds without a configured password must change it at first sign-in', async () => {
            const f = fakeContext(new MemoryKv(), { answers: [] });
            const m = track(await boot({ passwordHashIterations: 1000, seedUsers: [{ name: 'ops', email: 'ops@x.io', groups: ['admin'] }] }, f));
            expect(f.warnings.join()).toMatch(/default password/);
            const session = await m._runtime.auth.login('ops', 'root');
            expect(session.user.mustChangePassword).toBeTrue();
            await expectAsync(m._runtime.users.getUsers().toPromise()).toBeRejectedWith(jasmine.objectContaining({ status: 403 }));
            await m._runtime.auth.setPassword(session.user.id, 'a-better-password', 'root');
            expect(f.ctx.userSession.user.mustChangePassword).toBeFalse();
        });

        it('denies everything when the module fails to start', async () => {
            const f = fakeContext(new MemoryKv());
            const m: any = usersModule.configure({ server: 'missing' });
            await expectAsync(m.onInit(f.ctx)).toBeRejected();
            const auth = f.ctx.services.get(ICliAuthorizationService_TOKEN) as ICliAuthorizationService;
            expect(auth.can('anything')).toBeFalse();
            expect(auth.canAccess({ permissions: 'rwxrwxrwx', ownership: { uid: 'a', gid: 'b' } }, 'read')).toBeFalse();
        });

        it('reports seed failures instead of hiding them', async () => {
            const f = fakeContext(new MemoryKv());
            track(await boot({ ...LOCAL, seedUsers: [{ name: 'x', email: 'x@x.io', groups: ['missing'] }] }, f));
            expect(f.warnings.join()).toMatch(/could not seed 'x'.*unknown group/);
        });

        it('ends an expired session at the next command activity', async () => {
            const f = fakeContext(new MemoryKv());
            const m = track(await boot({ ...DEV, sessionTimeout: 40 }, f));
            expect(f.ctx.userSession).toBeDefined();
            await new Promise((r) => setTimeout(r, 80));
            const stillValid = await m._runtime.session.touch();
            expect(stillValid).toBeFalse();
            expect(f.ctx.userSession).toBeUndefined();
        });

        it('wraps processors so backend errors print one line', async () => {
            const f = fakeContext(new MemoryKv());
            const m = track(await boot(DEV, f));
            const groupdel = m.processors.find((p: any) => p.command === 'groupdel');
            const errors: string[] = [];
            await groupdel.processCommand({ value: 'admin', args: {} }, {
                ...f.ctx,
                writer: { ...f.ctx.writer, writeError: (t: string) => errors.push(t) },
                process: { exit: () => undefined },
            });
            expect(errors).toEqual(['groupdel: cannot delete built-in group: admin']);
            expect(usersModule.processors!.find((p) => p.command === 'groupdel')).not.toBe(groupdel);
        });

        it('requirePasswordOnBoot ends the previous session on the backend before asking', async () => {
            const kv = new MemoryKv();
            const f1 = fakeContext(kv);
            const m1 = track(await boot(LOCAL, f1));
            await m1._runtime.auth.login('root1', 'root');
            const oldToken = m1._runtime.session.getToken();
            expect(oldToken).toBeDefined();

            const f2 = fakeContext(kv);
            const m2 = track(await boot({ ...LOCAL, requirePasswordOnBoot: true }, f2));
            expect(f2.ctx.userSession).toBeUndefined();
            await expectAsync(m2._runtime.backend.currentSession(oldToken)).toBeRejectedWith(
                jasmine.objectContaining({ status: 401 }),
            );
        });

        it('extensions cannot forge built-in audit entries; custom entries record the signed-in user', async () => {
            const f = fakeContext(new MemoryKv());
            const m = track(await boot(LOCAL, f));
            await m._runtime.auth.login('root1', 'root');
            const audit = m._runtime.audit;
            await expectAsync(audit.log({ event: 'login', username: 'root1' })).toBeRejectedWith(
                jasmine.objectContaining({ status: 400 }),
            );
            await expectAsync(audit.log({ event: 'user_deleted', username: 'x' })).toBeRejectedWith(
                jasmine.objectContaining({ status: 400 }),
            );
            await audit.log({ event: 'deploy', username: 'someone-else', actor: 'ghost', details: 'v2' });
            const [entry] = await audit.getEntries({ event: 'deploy' });
            expect(entry.username).toBe('root1');
            expect(entry.actor).toBeUndefined();
            expect(entry.details).toBe('v2');
            expect((await audit.getEntries({ event: 'login' })).length).toBe(1); // the real one
        });

        it('a rename reports the previous name in the user_updated event', async () => {
            const f = fakeContext(new MemoryKv());
            const m = track(await boot(LOCAL, f));
            await m._runtime.auth.login('root1', 'root');
            await m._runtime.users.createUser({ name: 'alice', email: 'alice@x.io', password: 'password1' });
            const events: any[] = [];
            const sub = m._runtime.events.events$.subscribe((e: any) => events.push(e));
            await m._runtime.users.updateUser('alice', { name: 'alicia' });
            await m._runtime.users.updateUser('alicia', { email: 'a2@x.io' });
            sub.unsubscribe();
            const updates = events.filter((e) => e.type === 'user_updated');
            expect(updates[0].user.name).toBe('alicia');
            expect(updates[0].previousName).toBe('alice');
            expect(updates[1].previousName).toBeUndefined();
        });
    });

    describe('server mode', () => {
        function server(): { http: ICliHttpClient; state: { valid: boolean }; calls: string[] } {
            const state = { valid: true };
            const calls: string[] = [];
            const user = { id: 'u1', name: 'root', email: 'root@localhost', groups: ['admin'], disabled: false, createdAt: 1, updatedAt: 1 };
            const session = { id: 'S1', user, permissions: ['*'], loginTime: 1, lastActivity: 1 };
            const respond = async (method: string, url: string, _b?: any, o?: any) => {
                calls.push(`${method} ${url.replace('http://srv/api/v1/qcli', '')} ${o?.headers?.Authorization ?? ''}`.trim());
                if (method === 'POST' && url.endsWith('/sessions')) return { token: 'TOKEN', session };
                if (method === 'POST' && url.endsWith('/sessions/ws-ticket')) return { ticket: 'T1', expiresIn: 30 };
                if (!state.valid) throw new CliHttpError('unauthorized', 401, 'Unauthorized', { error: 'not authenticated' });
                if (url.endsWith('/sessions/current') && method === 'GET') return session;
                if (url.endsWith('/users')) return [user];
                return {};
            };
            const http: any = {
                get: (u: string, o?: any) => respond('GET', u, undefined, o),
                post: (u: string, b?: any, o?: any) => respond('POST', u, b, o),
                put: (u: string, b?: any, o?: any) => respond('PUT', u, b, o),
                delete: (u: string, o?: any) => respond('DELETE', u, undefined, o),
            };
            return { http, state, calls };
        }

        it('logs in, stores the token and shares it with other server requests', async () => {
            const srv = server();
            const kv = new MemoryKv();
            const f = fakeContext(kv, { http: srv.http });
            const m = track(await boot({ server: 'node' }, f));
            expect(f.ctx.userSession).toBeUndefined();

            await m._runtime.auth.login('root', 'admin');
            expect(f.ctx.userSession.user.name).toBe('root');
            expect(f.ctx.userSession.data.sessionId).toBe('S1');
            expect(await kv.get('cli-server-auth-token')).toBe('TOKEN');
            const providers = f.ctx.services.getAll(ICliServerAuthTokenProvider_TOKEN) as ICliServerAuthTokenProvider[];
            expect(providers[0].getHeaders('node')).toEqual({ Authorization: 'Bearer TOKEN' });
            expect(providers[0].getHeaders('python')).toEqual({});

            // reload restores from the token
            const f2 = fakeContext(kv, { http: srv.http });
            track(await boot({ server: 'node' }, f2));
            expect(f2.ctx.userSession.user.name).toBe('root');
        });

        it('websockets use a single-use ticket and the server reconnects on sign-in', async () => {
            const srv = server();
            const f = fakeContext(new MemoryKv(), { http: srv.http });
            const reconnects: string[] = [];
            f.ctx.services.set({ provide: 'cli-server-manager', useValue: { reconnect: async (n: string) => (reconnects.push(n), { success: true, commandCount: 1 }) } });
            const m = track(await boot({ server: 'node' }, f));
            const provider = (f.ctx.services.getAll(ICliServerAuthTokenProvider_TOKEN) as ICliServerAuthTokenProvider[])[0];
            expect(await provider.getWebSocketParams!('node')).toEqual({}); // signed out: no ticket
            await m._runtime.auth.login('root', 'admin');
            expect(await provider.getWebSocketParams!('node')).toEqual({ ticket: 'T1' });
            expect(await provider.getWebSocketParams!('python')).toBeUndefined();
            expect(srv.calls).toContain('POST /sessions/ws-ticket Bearer TOKEN');
            expect(reconnects).toEqual(['node']);
            await m._runtime.auth.logout();
            expect(reconnects).toEqual(['node', 'node']);
        });

        it('reconnects the server for a session restored at boot (page reload)', async () => {
            const srv = server();
            const kv = new MemoryKv();
            const f = fakeContext(kv, { http: srv.http });
            const m = track(await boot({ server: 'node' }, f));
            await m._runtime.auth.login('root', 'admin');

            // reload: the server's first connection ran before the token was restored
            const f2 = fakeContext(kv, { http: srv.http });
            const reconnects: string[] = [];
            f2.ctx.services.set({ provide: 'cli-server-manager', useValue: { reconnect: async (n: string) => (reconnects.push(n), { success: true, commandCount: 1 }) } });
            track(await boot({ server: 'node' }, f2));
            expect(f2.ctx.userSession.user.name).toBe('root');
            expect(reconnects).toEqual(['node']);
        });

        it('does not reconnect at boot without a session', async () => {
            const srv = server();
            const f = fakeContext(new MemoryKv(), { http: srv.http });
            const reconnects: string[] = [];
            f.ctx.services.set({ provide: 'cli-server-manager', useValue: { reconnect: async (n: string) => (reconnects.push(n), { success: true, commandCount: 1 }) } });
            track(await boot({ server: 'node' }, f));
            expect(reconnects).toEqual([]);
        });

        it('signs out once when the server rejects the token', async () => {
            const srv = server();
            const f = fakeContext(new MemoryKv(), { http: srv.http });
            const m = track(await boot({ server: 'node' }, f));
            await m._runtime.auth.login('root', 'admin');
            srv.state.valid = false;
            await expectAsync(m._runtime.backend.listUsers('TOKEN')).toBeRejected();
            await new Promise((r) => setTimeout(r));
            expect(f.ctx.userSession).toBeUndefined();
            expect(f.warnings).toEqual(['Session expired or revoked by the server. Please log in again.']);
        });

        it('a new login is kept when ending the previous, already invalid session fails with 401', async () => {
            // e.g. the server restarted (in-memory sessions) while alice was signed in
            const valid = new Set<string>();
            const userOf = (name: string) => ({ id: name, name, email: `${name}@x.io`, groups: ['users'], disabled: false, createdAt: 1, updatedAt: 1 });
            const http: any = {
                post: async (url: string, body: any) => {
                    const token = `T-${body.username}`;
                    valid.add(token);
                    return { token, session: { id: `S-${body.username}`, user: userOf(body.username), permissions: [], loginTime: 1, lastActivity: 1 } };
                },
                get: async () => ({}),
                put: async () => ({}),
                delete: async (_url: string, o?: any) => {
                    const token = String(o?.headers?.Authorization ?? '').replace('Bearer ', '');
                    if (!valid.has(token)) throw new CliHttpError('unauthorized', 401, 'Unauthorized', { error: 'not authenticated' });
                    valid.delete(token);
                    return {};
                },
            };
            const f = fakeContext(new MemoryKv(), { http });
            const m = track(await boot({ server: 'node' }, f));
            await m._runtime.auth.login('alice', 'pw');
            valid.clear(); // server restart
            await m._runtime.auth.login('bob', 'pw');
            await new Promise((r) => setTimeout(r));
            expect(f.ctx.userSession?.user.name).toBe('bob');
            expect(m._runtime.session.getToken()).toBe('T-bob');
            expect(f.warnings).toEqual([]);
        });

        it('logout with an already expired token signs out once, without a warning', async () => {
            const srv = server();
            const f = fakeContext(new MemoryKv(), { http: srv.http });
            const m = track(await boot({ server: 'node' }, f));
            await m._runtime.auth.login('root', 'admin');
            const events: string[] = [];
            const sub = m._runtime.events.events$.subscribe((e: any) => events.push(e.type));
            srv.state.valid = false;
            await m._runtime.auth.logout();
            await new Promise((r) => setTimeout(r));
            sub.unsubscribe();
            expect(f.ctx.userSession).toBeUndefined();
            expect(f.warnings).toEqual([]);
            expect(events).toEqual(['logout']);
        });

        it('signs out when an administrator kicks this session', async () => {
            const srv = server();
            const f = fakeContext(new MemoryKv(), { http: srv.http });
            const m = track(await boot({ server: 'node' }, f));
            await m._runtime.auth.login('root', 'admin');
            f.emit('server-events:node', 'session-kicked', { data: { sessionId: 'OTHER' } });
            expect(f.ctx.userSession).toBeDefined();
            f.emit('server-events:node', 'session-kicked', { data: { sessionId: 'S1', reason: 'revoked' } });
            await new Promise((r) => setTimeout(r));
            expect(f.ctx.userSession).toBeUndefined();
            expect(f.warnings[0]).toMatch(/terminated by an administrator \(revoked\)/);
            expect(f.prompts).toBe(1);
        });

        it('fails clearly for an unknown server name', async () => {
            const f = fakeContext(new MemoryKv());
            await expectAsync(boot({ server: 'nope' }, f)).toBeRejectedWithError(/server "nope" not found/);
        });

        it('stops listening on destroy', async () => {
            const srv = server();
            const f = fakeContext(new MemoryKv(), { http: srv.http });
            const m = await boot({ server: 'node' }, f);
            await m._runtime.auth.login('root', 'admin');
            const runtime = m._runtime;
            await m.onDestroy();
            f.emit('server-events:node', 'session-kicked', { data: { sessionId: 'S1' } });
            await new Promise((r) => setTimeout(r));
            expect(runtime.session.current).toBeDefined();
        });
    });
});

describe('usersModule host-managed auth', () => {
    function hostServer() {
        const user = { id: 'u7', name: 'jane', email: 'jane@corp', groups: ['ops'], disabled: false, createdAt: 1, updatedAt: 1 };
        const session = { id: 'H1', user, permissions: ['deploy:run'], loginTime: 1, lastActivity: 1 };
        const seen: string[] = [];
        const http: any = {
            get: async (url: string, o?: any) => {
                seen.push(`${url} ${o?.headers?.Authorization}`);
                if (o?.headers?.Authorization === 'Bearer HOST-TOKEN') return session;
                throw new CliHttpError('unauthorized', 401, 'Unauthorized', { error: 'not authenticated' });
            },
            post: async () => { throw new Error('login must not be called'); },
            put: async () => ({}),
            delete: async () => ({}),
        };
        return { http, seen };
    }

    it('reuses the host token, never stores it, and delegates login/logout', async () => {
        const srv = hostServer();
        const kv = new MemoryKv();
        let token: string | undefined = 'HOST-TOKEN';
        let loggedOut = false;
        const f = fakeContext(kv, { http: srv.http });
        const m: any = usersModule.configure({
            server: 'node',
            hostAuth: { getToken: () => token, loginHint: 'Sign in at https://corp/login', logout: () => { loggedOut = true; token = undefined; } },
        });
        await m.onInit(f.ctx);
        try {
            expect(f.ctx.userSession.user.name).toBe('jane');
            expect(f.ctx.userSession.permissions).toEqual(['deploy:run']);
            expect(await kv.get('cli-server-auth-token')).toBeUndefined();

            await m._runtime.auth.logout();
            expect(loggedOut).toBeTrue();
            expect(f.ctx.userSession).toBeUndefined();

            await expectAsync(m._runtime.auth.login('jane', 'x')).toBeRejectedWith(
                jasmine.objectContaining({ status: 501, message: 'Sign in at https://corp/login' }),
            );
            token = 'HOST-TOKEN';
            const s = await m._runtime.auth.login('');
            expect(s.user.name).toBe('jane');
            await expectAsync(m._runtime.auth.switchUser('root')).toBeRejectedWith(jasmine.objectContaining({ status: 501 }));
        } finally {
            await m.onDestroy();
        }
    });

    it('memory-only tokens are not persisted', async () => {
        const kv = new MemoryKv();
        const f = fakeContext(kv);
        const m: any = usersModule.configure({ ...DEV, persistToken: false });
        await m.onInit(f.ctx);
        try {
            expect(f.ctx.userSession.user.name).toBe('root1');
            expect(await kv.get('cli-users-token')).toBeUndefined();
        } finally {
            await m.onDestroy();
        }
    });
});

describe('CliUserSessionService', () => {
    function deferred<T>() {
        let resolve!: (v: T) => void;
        let reject!: (e: unknown) => void;
        const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
        return { promise, resolve, reject };
    }
    const sessionOf = (name: string) => ({
        id: `S-${name}`,
        user: { id: name, name, email: `${name}@x.io`, groups: ['users'], disabled: false, createdAt: 1, updatedAt: 1 },
        permissions: [] as string[],
        loginTime: 1,
        lastActivity: 1,
    });

    function setup() {
        const pending: Array<ReturnType<typeof deferred<any>>> = [];
        const backend: any = {
            kind: 'server',
            currentSession: () => {
                const d = deferred<any>();
                pending.push(d);
                return d.promise;
            },
        };
        const session = new CliUserSessionService(backend, new MemoryKv(), 'token-key');
        return { session, pending };
    }

    it('ignores a refresh answer for a token that was replaced meanwhile', async () => {
        const { session, pending } = setup();
        await session.start({ token: 'A', session: sessionOf('alice') });
        const refreshing = session.refresh();
        await session.start({ token: 'B', session: sessionOf('bob') }); // su bob
        pending[0].resolve(sessionOf('alice'));
        await refreshing;
        expect(session.current?.user.name).toBe('bob');
        expect(session.getToken()).toBe('B');
    });

    it('a 401 for a replaced token does not end the new session', async () => {
        const { session, pending } = setup();
        await session.start({ token: 'A', session: sessionOf('alice') });
        const refreshing = session.refresh();
        await session.start({ token: 'B', session: sessionOf('bob') });
        pending[0].reject(new CliUsersError(401, 'session expired'));
        await refreshing;
        expect(session.current?.user.name).toBe('bob');
        expect(session.getToken()).toBe('B');
    });
});

describe('usersModule unload', () => {
    it('removes the services it registered, the deny-all placeholder included', async () => {
        const f = fakeContext(new MemoryKv());
        const services: CliServiceContainer = f.ctx.services;
        const own = { allowed: true } as unknown as ICliAuthorizationService;
        services.set({ provide: ICliAuthorizationService_TOKEN, useValue: own });

        const m = await boot({ server: 'node' }, f);
        expect(services.get(ICliAuthorizationService_TOKEN)).not.toBe(own);
        expect(services.getAll(ICliServerAuthTokenProvider_TOKEN).length).toBe(1);

        await m.onDestroy(f.ctx);

        // The host's own authorization service is active again: neither the
        // runtime's nor the deny-all one is left behind
        expect(services.get(ICliAuthorizationService_TOKEN)).toBe(own);
        expect(services.getAll(ICliServerAuthTokenProvider_TOKEN)).toEqual([]);
        expect(services.has('cli-user-session-service')).toBeFalse();
    });
});

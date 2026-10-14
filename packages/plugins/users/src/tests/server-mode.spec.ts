import {
    CliHttpError,
    ICliHttpClient,
    ICliKeyValueStore,
    ICliAuditService_TOKEN,
    ICliUserEventService_TOKEN,
    ICliUserEventService,
    ICliServerAuthTokenProvider_TOKEN,
    ICliServerAuthTokenProvider,
    ICliUserSessionService_TOKEN,
    ICliUserSessionService,
} from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';
import { usersModule } from '../public-api';
import { CliServerAuditService } from '../lib/services/cli-server-audit.service';

const BASE_URL = 'http://srv/api/v1/qcli';
const USER = { id: 'u1', name: 'alice', email: 'a@b.com', groups: ['admin'], createdAt: 0, updatedAt: 0 };

class MemoryKv implements ICliKeyValueStore {
    private store = new Map<string, any>();
    async get<T>(key: string): Promise<T | undefined> { return this.store.get(key) as T; }
    async set(key: string, value: any): Promise<void> { this.store.set(key, value); }
    async remove(key: string): Promise<void> { this.store.delete(key); }
    async clear(): Promise<void> { this.store.clear(); }
}

/** Minimal service container supporting value/class providers and multi-providers. */
class FakeServices {
    private single = new Map<string, any>();
    private multi = new Map<string, any[]>();

    set(providers: any | any[]): void {
        for (const p of Array.isArray(providers) ? providers : [providers]) {
            const value = 'useValue' in p ? p.useValue : new p.useClass();
            if (p.multi) {
                this.multi.set(p.provide, [...(this.multi.get(p.provide) ?? []), value]);
            } else {
                this.single.set(p.provide, value);
            }
        }
    }
    get<T>(token: string): T | undefined { return this.single.get(token); }
    getRequired<T>(token: string): T {
        const v = this.single.get(token);
        if (v === undefined) throw new Error(`Missing service ${token}`);
        return v;
    }
    getAll<T>(token: string): T[] { return this.multi.get(token) ?? []; }
}

interface Harness {
    context: any;
    kv: MemoryKv;
    http: ICliHttpClient;
    responses: Record<string, any>;
    emitServerEvent: (event: any) => void;
    warnings: string[];
    unsubscribe: jasmine.Spy;
    module: any;
}

function createHarness(): Harness {
    const responses: Record<string, any> = {};
    const resolve = (method: string, url: string) => {
        const key = `${method} ${url}`;
        if (!(key in responses)) throw new Error(`no mock for ${key}`);
        const r = responses[key];
        return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
    };
    const http: ICliHttpClient = {
        fetch: jasmine.createSpy('fetch'),
        head: jasmine.createSpy('head'),
        get: jasmine.createSpy('get').and.callFake((url: string) => resolve('GET', url)),
        post: jasmine.createSpy('post').and.callFake((url: string) => resolve('POST', url)),
        put: jasmine.createSpy('put').and.callFake((url: string) => resolve('PUT', url)),
        patch: jasmine.createSpy('patch').and.callFake((url: string) => resolve('PATCH', url)),
        delete: jasmine.createSpy('delete').and.callFake((url: string) => resolve('DELETE', url)),
        options: jasmine.createSpy('options').and.callFake((url: string) => resolve('OPTIONS', url)),
    };

    let handler: ((e: any) => void) | undefined;
    let filter: any;
    const unsubscribe = jasmine.createSpy('unsubscribe');
    const warnings: string[] = [];

    const context = {
        options: { servers: [{ name: 'node', url: 'http://srv/' }] },
        http,
        services: new FakeServices(),
        writer: { writeWarning: (m: string) => warnings.push(m) },
        backgroundServices: {
            on: (h: (e: any) => void, f: any) => { handler = h; filter = f; return unsubscribe; },
        },
        userSession: undefined as any,
    };

    const emitServerEvent = (event: any) => {
        if (!handler) throw new Error('no server event handler registered');
        if (filter?.source && event.source !== filter.source) return;
        if (filter?.type && event.type !== filter.type) return;
        handler(event);
    };

    // Clone so the shared module's static processor list is not mutated
    const module: any = { ...usersModule, processors: [...usersModule.processors!] };

    return { context, kv: new MemoryKv(), http, responses, emitServerEvent, warnings, unsubscribe, module };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('usersModule server mode', () => {
    let h: Harness;

    beforeEach(() => {
        h = createHarness();
    });

    async function initLoggedIn(sessionId = 'sess-1'): Promise<void> {
        await h.kv.set('cli-server-auth-token', 'tok-1');
        h.responses[`GET ${BASE_URL}/sessions/current`] = { id: sessionId, user: USER, loginTime: 1, lastActivity: 2 };
        await h.module._initServerMode(h.context, { server: 'node' }, h.kv);
    }

    it('throws when the configured server is unknown', async () => {
        await expectAsync(
            h.module._initServerMode(h.context, { server: 'missing' }, h.kv),
        ).toBeRejectedWithError(/server "missing" not found/);
    });

    it('registers a server-backed audit service and the session processors', async () => {
        await initLoggedIn();

        expect(h.context.services.get(ICliAuditService_TOKEN) instanceof CliServerAuditService).toBeTrue();
        const commands = h.module.processors.map((p: any) => p.command);
        expect(commands).toContain('sessions');
        expect(commands).toContain('session-kick');
        expect(usersModule.processors!.map((p) => p.command)).not.toContain('sessions');
    });

    it('restores the session and exposes the bearer token to the server connection', async () => {
        await initLoggedIn();

        expect(h.context.userSession?.user.name).toBe('alice');
        expect(h.context.userSession?.displayName).toBe('alice');
        const providers = h.context.services.getAll(ICliServerAuthTokenProvider_TOKEN) as ICliServerAuthTokenProvider[];
        expect(providers.length).toBe(1);
        expect(providers[0].getHeaders('node')).toEqual({ Authorization: 'Bearer tok-1' });
        expect(providers[0].getHeaders('other')).toEqual({});
    });

    it('logs out locally when the server kicks this session', async () => {
        await initLoggedIn('sess-1');
        const events: any[] = [];
        const eventService = h.context.services.getRequired(ICliUserEventService_TOKEN) as ICliUserEventService;
        eventService.events$.subscribe((e: any) => events.push(e));

        h.emitServerEvent({
            source: 'server-events:node',
            type: 'session-kicked',
            data: { type: 'session-kicked', data: { sessionId: 'sess-1', userId: 'u1' } },
        });
        await flush();

        expect(h.context.userSession).toBeUndefined();
        expect(await h.kv.get('cli-server-auth-token')).toBeUndefined();
        const providers = h.context.services.getAll(ICliServerAuthTokenProvider_TOKEN) as ICliServerAuthTokenProvider[];
        expect(providers[0].getHeaders('node')).toEqual({});
        expect(events.length).toBe(1);
        expect(events[0].type).toBe('logout');
        expect(events[0].details).toContain('administrator');
        expect(h.warnings.length).toBe(1);
        expect(h.warnings[0]).toContain('administrator');
    });

    it('ignores kick events for other sessions', async () => {
        await initLoggedIn('sess-1');

        h.emitServerEvent({
            source: 'server-events:node',
            type: 'session-kicked',
            data: { type: 'session-kicked', data: { sessionId: 'sess-other', userId: 'u9' } },
        });
        await flush();

        expect(h.context.userSession?.user.name).toBe('alice');
        expect(await h.kv.get('cli-server-auth-token')).toBe('tok-1');
        expect(h.warnings.length).toBe(0);
    });

    it('drops the session when a server request returns 401', async () => {
        await initLoggedIn();
        h.responses[`GET ${BASE_URL}/users`] = new CliHttpError('Invalid or expired session', 401);
        const sessionService = h.context.services.getRequired(ICliUserSessionService_TOKEN) as ICliUserSessionService;

        const usersStore = h.context.services.getRequired('cli-users-store-service');
        await expectAsync(firstValueFrom(usersStore.getUsers())).toBeRejected();
        await flush();

        expect(await firstValueFrom(sessionService.getUserSession())).toBeUndefined();
        expect(h.context.userSession).toBeUndefined();
        expect(await h.kv.get('cli-server-auth-token')).toBeUndefined();
        expect(h.warnings[0]).toContain('expired or revoked');
    });

    it('does not treat a failed login as an expired session', async () => {
        await initLoggedIn();
        h.responses[`POST ${BASE_URL}/auth/login`] = new CliHttpError('Invalid credentials', 401);
        const auth = h.context.services.getRequired('cli-auth-service');

        await expectAsync(auth.login('bob', 'wrong')).toBeRejected();
        await flush();

        expect(h.context.userSession?.user.name).toBe('alice');
        expect(await h.kv.get('cli-server-auth-token')).toBe('tok-1');
        expect(h.warnings.length).toBe(0);
    });

    it('starts signed out when the stored token is rejected', async () => {
        await h.kv.set('cli-server-auth-token', 'stale');
        h.responses[`GET ${BASE_URL}/sessions/current`] = new CliHttpError('Invalid or expired session', 401);

        await h.module._initServerMode(h.context, { server: 'node' }, h.kv);
        await flush();

        expect(h.context.userSession).toBeUndefined();
        expect(await h.kv.get('cli-server-auth-token')).toBeUndefined();
    });

    it('unsubscribes from server events on destroy', async () => {
        await initLoggedIn();

        await h.module.onDestroy();

        expect(h.unsubscribe).toHaveBeenCalledTimes(1);
        expect(h.module._serverEventsUnsubscribe).toBeUndefined();
    });
});

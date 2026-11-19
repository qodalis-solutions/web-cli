import { CliTestHarness } from '@qodalis/cli';
import { CliHttpError, ICliHttpClient, ICliPermissionRegistry, ICliPermissionRegistry_TOKEN } from '@qodalis/cli-core';
import { usersModule, usersPermissionDefinitions } from '../public-api';
import { createUsersRuntime, CliUsersRuntime } from '../lib/module/users-runtime';
import { bindSessionToContext, bindTermination, wrapProcessors } from '../lib/module/session-lifecycle';
import { CliHttpUsersBackend } from '../lib/backend/http-users-backend';
import {
    claudeMcpAddExample,
    CliTokenCommandProcessor,
    parseExpires,
} from '../lib/processors/cli-token-command-processor';
import { CliApiTokensService_TOKEN } from '../lib/services/cli-users-services';

const WARNING = '[warn] Copy the token now: it will not be shown again.';
const LOCAL_MESSAGE =
    'API tokens are available when the CLI is connected to a server (usersModule.configure({ server }))';

interface FakeToken {
    id: string;
    name: string;
    userId: string;
    userName: string;
    createdAt: number;
    expiresAt: number | null;
    lastUsedAt: number | null;
    audience?: 'cli' | 'host';
    permissions?: string[] | null;
}

/** The `/permissions` catalog the fake server answers (contract C1/C4). */
const PERMISSIONS = [
    { name: 'files:read', description: 'List, read and download files', group: 'Files', surface: 'cli' },
    { name: 'files:write', description: 'Upload, create and delete files', group: 'Files', surface: 'cli' },
    { name: 'jobs:read', description: 'See jobs and their runs', group: 'Jobs', surface: 'cli' },
    { name: 'rates:read', description: 'Official exchange rates', group: 'Rates', surface: 'host' },
];
const USERS_READ = { name: 'users:read', description: 'See users and their permissions', group: 'Users', surface: 'cli' };

/** Minimal users-plugin server: sessions + the `/tokens` endpoints of the spec. */
function fakeServer(config: { permissions?: 'missing' | 'empty' } = {}) {
    const root = { id: 'u1', name: 'root', email: 'root@localhost', groups: ['admin'], disabled: false, createdAt: 1, updatedAt: 1 };
    const session = { id: 'S1', user: root, permissions: ['*'], loginTime: 1, lastActivity: 1 };
    const tokens: FakeToken[] = [
        { id: 'tok-bob', name: 'bob-ci', userId: 'u2', userName: 'bob', createdAt: 1, expiresAt: null, lastUsedAt: null },
    ];
    const calls: Array<{ method: string; path: string; body?: any; auth?: string }> = [];
    let next = 1;
    const fail = (status: number, error: string) => {
        throw new CliHttpError(error, status, 'Error', { error });
    };
    const respond = async (method: string, url: string, body?: any, options?: any): Promise<any> => {
        const path = url.replace('http://srv/api/v1/qcli', '');
        calls.push({ method, path, body, auth: options?.headers?.Authorization });
        if (path === '/sessions/current' && method === 'GET') return session;
        if (path.startsWith('/permissions') && method === 'GET') {
            if (config.permissions === 'missing') fail(404, 'Not Found');
            if (config.permissions === 'empty') return [];
            return path.endsWith('?all=true') ? [...PERMISSIONS, USERS_READ] : PERMISSIONS;
        }
        if (path.startsWith('/tokens')) {
            if (method === 'GET') return path.endsWith('?all=true') ? tokens : tokens.filter((t) => t.userId === 'u1');
            if (method === 'POST') {
                if (!body?.name) fail(400, 'name is required');
                if (tokens.some((t) => t.userId === 'u1' && t.name.toLowerCase() === body.name.toLowerCase())) {
                    fail(409, `token already exists: ${body.name}`);
                }
                const days = body.expiresInDays === undefined ? 90 : body.expiresInDays;
                const apiToken: FakeToken = {
                    id: `tok-${next++}`,
                    name: body.name,
                    userId: 'u1',
                    userName: 'root',
                    createdAt: Date.now(),
                    expiresAt: days === null ? null : Date.now() + days * 86400000,
                    lastUsedAt: null,
                    permissions: body.permissions ?? null,
                };
                tokens.push(apiToken);
                return { token: `qcli_pat_secret${apiToken.id}`, apiToken };
            }
            if (method === 'DELETE') {
                const id = decodeURIComponent(path.slice('/tokens/'.length));
                const i = tokens.findIndex((t) => t.id === id);
                if (i < 0) fail(404, `token not found: ${id}`);
                tokens.splice(i, 1);
                return undefined;
            }
        }
        return {};
    };
    const http: any = {
        get: (u: string, o?: any) => respond('GET', u, undefined, o),
        post: (u: string, b?: any, o?: any) => respond('POST', u, b, o),
        put: (u: string, b?: any, o?: any) => respond('PUT', u, b, o),
        delete: (u: string, o?: any) => respond('DELETE', u, undefined, o),
    };
    return { http: http as ICliHttpClient, tokens, calls, session };
}

type Run = (cmd: string) => Promise<{ out: string; err: string; code?: number }>;

async function harness(config: any, http?: ICliHttpClient): Promise<{ h: CliTestHarness; rt: CliUsersRuntime; run: Run }> {
    const h = new CliTestHarness();
    const ctx: any = {
        services: h.services,
        options: { servers: [{ name: 'node', url: 'http://srv/' }] },
        http,
        writer: { writeln() {}, writeWarning() {}, writeError() {}, writeInfo() {} },
        showPrompt() {},
    };
    const rt = await createUsersRuntime(ctx, config);
    bindSessionToContext(ctx, rt);
    h.registerProcessors(wrapProcessors(usersModule.processors!, rt, bindTermination(ctx, rt)));
    h.services.get<ICliPermissionRegistry>(ICliPermissionRegistry_TOKEN)!.register(usersPermissionDefinitions, 'users');
    h.setUserSessionProvider(() => rt.session.current);
    const run: Run = async (cmd) => {
        const r = await h.execute(cmd);
        return {
            out: r.stdout.join('\n'),
            err: r.stderr.map((l: string) => l.replace(/^\[error\] /, '')).join('\n'),
            code: r.exitCode,
        };
    };
    return { h, rt, run };
}

async function serverSetup(options: { permissions?: 'missing' | 'empty' } = {}) {
    const srv = fakeServer(options);
    const t = await harness({ server: 'node' }, srv.http);
    await t.rt.session.start({ token: 'TOKEN', session: srv.session as any });
    return { ...t, srv };
}

describe('token commands (server mode)', () => {
    it('token create prints the token once, a warning and the claude mcp add example', async () => {
        const { run, srv } = await serverSetup();
        const r = await run('token create ci-bot');
        expect(r.err).toBe(WARNING);
        expect(r.out).toContain("Token 'ci-bot' created (id tok-1, expires");
        expect(r.out).toContain('qcli_pat_secrettok-1');
        expect(r.out).toContain(
            'claude mcp add --transport http qcli http://srv/api/qcli/mcp --header "Authorization: Bearer qcli_pat_secrettok-1"',
        );
        const post = srv.calls.find((c) => c.method === 'POST' && c.path === '/tokens')!;
        expect(post.body).toEqual({ name: 'ci-bot' });
        expect(post.auth).toBe('Bearer TOKEN');
    });

    it('token create takes a quoted name with spaces', async () => {
        const { run, srv } = await serverSetup();
        await run(`token create "CI bot"`);
        const post = srv.calls.find((c) => c.method === 'POST' && c.path === '/tokens')!;
        expect(post.body).toEqual({ name: 'CI bot' });
    });

    it('token create sends --expires and --permissions', async () => {
        const { run, srv } = await serverSetup();
        const r = await run('token create reader --expires=30 --permissions=commands:execute,users:read');
        expect(r.err).toBe(WARNING);
        expect(r.out).toContain('Scope: commands:execute, users:read');
        const post = srv.calls.find((c) => c.method === 'POST' && c.path === '/tokens')!;
        expect(post.body).toEqual({ name: 'reader', expiresInDays: 30, permissions: ['commands:execute', 'users:read'] });
    });

    it('token create --expires=never asks for a non-expiring token', async () => {
        const { run, srv } = await serverSetup();
        const r = await run('token create forever --expires=never');
        expect(r.err).toBe(WARNING);
        expect(r.out).toContain('never expires');
        const post = srv.calls.find((c) => c.method === 'POST' && c.path === '/tokens')!;
        expect(post.body).toEqual({ name: 'forever', expiresInDays: null });
    });

    it('token create rejects an invalid --expires without calling the server', async () => {
        const { run, srv } = await serverSetup();
        const r = await run('token create x --expires=soon');
        expect(r.err).toBe("token create: invalid --expires 'soon': use a number of days (1-365) or 'never'");
        expect(srv.calls.some((c) => c.method === 'POST')).toBeFalse();
    });

    it('server errors are printed as one line', async () => {
        const { run } = await serverSetup();
        await run('token create dup');
        const r = await run('token create dup');
        expect(r.err).toBe('token create: token already exists: dup');
        expect(r.code).not.toBe(0);
        expect((await run('token revoke nope')).err).toBe('token revoke: token not found: nope');
    });

    it('token list shows own tokens; --all adds the USER column', async () => {
        const { run } = await serverSetup();
        expect((await run('token list')).out).toContain('No API tokens');
        await run('token create ci-bot --permissions=commands:execute');
        let r = await run('token list');
        expect(r.err).toBe('');
        for (const col of ['NAME', 'ID', 'EXPIRES', 'LAST USED', 'SCOPE']) expect(r.out).toContain(col);
        expect(r.out).not.toContain('USER ');
        expect(r.out).toContain('ci-bot');
        expect(r.out).toContain('commands:execute');
        expect(r.out).not.toContain('bob-ci');

        r = await run('token list --all');
        expect(r.out).toContain('USER');
        expect(r.out).toContain('bob-ci');
        expect(r.out).toContain('bob');
        expect(r.out).toContain('(all)');
    });

    it('token revoke deletes by id', async () => {
        const { run, srv } = await serverSetup();
        const r = await run('token revoke tok-bob');
        expect(r.err).toBe('');
        expect(r.out).toContain('Token tok-bob revoked');
        expect(srv.calls.some((c) => c.method === 'DELETE' && c.path === '/tokens/tok-bob')).toBeTrue();
        expect(srv.tokens.length).toBe(0);
    });

    it('token permissions prints the groups, names and descriptions', async () => {
        const { run, srv } = await serverSetup();
        const r = await run('token permissions');
        expect(r.err).toBe('');
        for (const text of ['GROUP', 'PERMISSION', 'DESCRIPTION', 'Files', 'files:read', 'List, read and download files', 'rates:read (host)']) {
            expect(r.out).toContain(text);
        }
        expect(r.out).not.toContain('users:read');
        expect(srv.calls.some((c) => c.method === 'GET' && c.path === '/permissions')).toBeTrue();
        expect(srv.calls.find((c) => c.path === '/permissions')!.auth).toBe('Bearer TOKEN');
    });

    it('token permissions keeps the server order', async () => {
        const { h, srv } = await serverSetup();
        const r = await h.execute('token permissions');
        expect(r.tables[0].headers).toEqual(['GROUP', 'PERMISSION', 'DESCRIPTION']);
        expect(r.tables[0].rows.map((row) => row[1])).toEqual(['files:read', 'files:write', 'jobs:read', 'rates:read (host)']);
        expect(srv.calls.length).toBeGreaterThan(0);
    });

    it('token permissions --all asks for every permission', async () => {
        const { run, srv } = await serverSetup();
        const r = await run('token permissions --all');
        expect(r.out).toContain('users:read');
        expect(srv.calls.some((c) => c.method === 'GET' && c.path === '/permissions?all=true')).toBeTrue();
        await run('token permissions -a');
        expect(srv.calls.filter((c) => c.path === '/permissions?all=true').length).toBe(2);
    });

    it('token permissions with an empty list', async () => {
        const { run } = await serverSetup({ permissions: 'empty' });
        expect((await run('token permissions')).out).toContain('[info] No permissions');
    });

    it('token permissions on an older server', async () => {
        const { run } = await serverSetup({ permissions: 'missing' });
        const r = await run('token permissions');
        expect(r.err).toContain('needs server 1.0.0-beta.29');
        expect(r.err).toBe(
            'token permissions: this server does not list its permissions (needs server 1.0.0-beta.29 or later)',
        );
    });

    it('token create --select sends the chosen permissions', async () => {
        const { h, run, srv } = await serverSetup();
        h.setReaderResponses(['rates:read', 'files:read']);
        const r = await run('token create picker --select');
        expect(r.err).toBe(WARNING);
        const post = srv.calls.find((c) => c.method === 'POST' && c.path === '/tokens')!;
        expect(post.body.permissions).toEqual(['files:read', 'rates:read']);
        expect(r.out).toContain('Scope: files:read, rates:read');
        expect(srv.calls.some((c) => c.method === 'GET' && c.path === '/permissions')).toBeTrue();
    });

    it('picking equals typing', async () => {
        const picked = await serverSetup();
        picked.h.setReaderResponses(['files:read', 'jobs:read']);
        await picked.run('token create same --select');
        const typed = await serverSetup();
        await typed.run('token create same --permissions=files:read,jobs:read');
        const body = (srv: ReturnType<typeof fakeServer>) =>
            srv.calls.find((c) => c.method === 'POST' && c.path === '/tokens')!.body;
        expect(body(picked.srv)).toEqual(body(typed.srv));
    });

    it('token create --select with nothing chosen creates nothing', async () => {
        const { h, run, srv } = await serverSetup();
        h.setReaderResponses([]);
        const r = await run('token create none --select');
        expect(r.out).toContain('[info] No permissions selected; token not created');
        expect(srv.calls.some((c) => c.method === 'POST')).toBeFalse();
    });

    it('token create --select --permissions=a is refused', async () => {
        const { run, srv } = await serverSetup();
        const r = await run('token create both --select --permissions=a');
        expect(r.err).toBe('token create: use --select or --permissions, not both');
        expect(srv.calls.some((c) => c.path.startsWith('/permissions') || c.method === 'POST')).toBeFalse();
    });

    it('token create --select with an empty list is refused', async () => {
        const { run, srv } = await serverSetup({ permissions: 'empty' });
        const r = await run('token create none --select');
        expect(r.err).toBe('token create: the server lists no permissions you hold; use --permissions');
        expect(srv.calls.some((c) => c.method === 'POST')).toBeFalse();
    });

    it('token create --select on an older server', async () => {
        const { run, srv } = await serverSetup({ permissions: 'missing' });
        const r = await run('token create old --select');
        expect(r.err).toContain('needs server 1.0.0-beta.29');
        expect(srv.calls.some((c) => c.method === 'POST')).toBeFalse();
    });

    it('token list marks host tokens', async () => {
        const { run, srv } = await serverSetup();
        srv.tokens.push({
            id: 'tok-host', name: 'rates-app', userId: 'u1', userName: 'root', createdAt: 1,
            expiresAt: null, lastUsedAt: null, audience: 'host', permissions: ['rates:read'],
        });
        const r = await run('token list');
        expect(r.out).toContain('rates:read (host)');
    });

    it('requires login', async () => {
        const srv = fakeServer();
        const { run } = await harness({ server: 'node' }, srv.http);
        expect((await run('token list')).err).toContain('login required');
    });
});

describe('token commands (local mode)', () => {
    it('print where API tokens are available', async () => {
        const { run, rt } = await harness({ passwordHashIterations: 1000 });
        await rt.local!.createUserInternal({ name: 'root', email: 'root@localhost', groups: ['admin'], password: 'root', skipPasswordPolicy: true });
        await rt.session.start(await rt.local!.startTrustedSession('root'));
        expect((await run('token list')).err).toBe(`token list: ${LOCAL_MESSAGE}`);
        expect((await run('token create x')).err).toBe(`token create: ${LOCAL_MESSAGE}`);
        expect((await run('token revoke x')).err).toBe(`token revoke: ${LOCAL_MESSAGE}`);
        expect((await run('token permissions')).err).toBe(`token permissions: ${LOCAL_MESSAGE}`);
        expect((await run('token')).err).toBe(`token: ${LOCAL_MESSAGE}`);
    });
});

describe('token create --select (processor)', () => {
    it('cancelling the picker creates nothing', async () => {
        const create = new CliTokenCommandProcessor().processors.find((p) => p.command === 'create')!;
        const service = jasmine.createSpyObj('tokens', ['permissions', 'create']);
        Object.assign(service, { supported: true });
        service.permissions.and.resolveTo([
            { name: 'files:read', description: 'List, read and download files', group: 'Files', surface: 'cli' },
        ]);
        const info: string[] = [];
        let pickerArgs: any[] = [];
        const context: any = {
            services: { get: (token: unknown) => (token === CliApiTokensService_TOKEN ? service : undefined) },
            reader: {
                readMultiSelect: async (...args: any[]) => {
                    pickerArgs = args;
                    return null;
                },
            },
            writer: { writeInfo: (m: string) => info.push(m) },
        };
        await create.processCommand({ command: 'token create', value: 'x', args: { select: true } } as any, context);
        expect(info).toEqual(['Cancelled']);
        expect(service.create).not.toHaveBeenCalled();
        expect(pickerArgs[0]).toBe('Permissions for x:');
        expect(pickerArgs[1]).toEqual([
            { label: 'files:read', value: 'files:read', description: 'List, read and download files', group: 'Files' },
        ]);
        expect(pickerArgs[2]).toEqual({ searchable: true });
    });
});

describe('token helpers', () => {
    it('parseExpires', () => {
        expect(parseExpires(undefined)).toBeUndefined();
        expect(parseExpires('never')).toBeNull();
        expect(parseExpires('NEVER')).toBeNull();
        expect(parseExpires('7')).toBe(7);
        expect(parseExpires(30)).toBe(30);
        expect(() => parseExpires('1.5')).toThrow();
    });

    it('claudeMcpAddExample falls back to a placeholder without a server URL', () => {
        expect(claudeMcpAddExample(undefined, 'T')).toBe(
            'claude mcp add --transport http qcli <server>/api/qcli/mcp --header "Authorization: Bearer T"',
        );
        expect(claudeMcpAddExample('https://cli.example.com/', 'T')).toContain('https://cli.example.com/api/qcli/mcp');
    });

    it('custom backends exposing baseUrl get the right server URL', async () => {
        const srv = fakeServer();
        const { rt } = await harness({ backend: new CliHttpUsersBackend('http://srv/api/v1/qcli', srv.http) });
        expect(rt.tokens.serverUrl).toBe('http://srv');
        expect(rt.tokens.supported).toBeTrue();
    });
});

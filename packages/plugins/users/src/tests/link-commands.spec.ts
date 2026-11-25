import { CliTestHarness } from '@qodalis/cli';
import { CliHttpError, ICliHttpClient, ICliPermissionRegistry, ICliPermissionRegistry_TOKEN } from '@qodalis/cli-core';
import { usersModule, usersPermissionDefinitions } from '../public-api';
import { createUsersRuntime, CliUsersRuntime } from '../lib/module/users-runtime';
import { bindSessionToContext, bindTermination, wrapProcessors } from '../lib/module/session-lifecycle';
import { CliLinkCommandProcessor, normalizeLinkCode } from '../lib/processors/cli-link-command-processor';
import { LINKS_LOCAL_MESSAGE } from '../lib/services/cli-users-services';

const PENDING = {
    userCode: 'ABCD-2345',
    client: 'Qodalis CLI on Pixel 7',
    origin: 'https://cli.example.com',
    remoteAddress: '10.0.0.7',
    permissions: null as string[] | null,
    createdAt: Date.now(),
    expiresAt: Date.now() + 600_000,
};

/** Minimal users-plugin server: the current session and the link approval routes. */
function fakeServer(config: { approveStatus?: number; permissions?: string[] } = {}) {
    const root = { id: 'u1', name: 'root', email: 'root@localhost', groups: ['admin'], disabled: false, createdAt: 1, updatedAt: 1 };
    const session = { id: 'S1', user: root, permissions: ['*'], loginTime: 1, lastActivity: 1 };
    const pending = new Map([['ABCD-2345', { ...PENDING, permissions: config.permissions ?? null }]]);
    const calls: Array<{ method: string; path: string; body?: any; auth?: string }> = [];
    const fail = (status: number, error: string) => {
        throw new CliHttpError(error, status, 'Error', { error });
    };
    const respond = async (method: string, url: string, body?: any, options?: any): Promise<any> => {
        const path = url.replace('http://srv/api/v1/qcli', '');
        calls.push({ method, path, body, auth: options?.headers?.Authorization });
        if (path === '/sessions/current' && method === 'GET') return session;
        const match = /^\/link\/code\/([^/]+)(?:\/(approve|deny))?$/.exec(path);
        if (match) {
            const code = decodeURIComponent(match[1]);
            const link = pending.get(code);
            if (!link) fail(404, 'link request not found or expired');
            if (!match[2] && method === 'GET') return link;
            if (match[2] === 'approve' && method === 'POST') {
                if (config.approveStatus) fail(config.approveStatus, 'API tokens are not enabled on this server');
                pending.delete(code);
                return { tokenId: 'tok-9', tokenName: `link ${link!.client}` };
            }
            if (match[2] === 'deny' && method === 'POST') {
                pending.delete(code);
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
    return { http: http as ICliHttpClient, calls, session, pending };
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

async function serverSetup(options: { approveStatus?: number; permissions?: string[] } = {}) {
    const srv = fakeServer(options);
    const t = await harness({ server: 'node' }, srv.http);
    await t.rt.session.start({ token: 'TOKEN', session: srv.session as any });
    return { ...t, srv };
}

const linkCalls = (calls: Array<{ method: string; path: string }>) =>
    calls.filter((c) => c.path.startsWith('/link')).map((c) => `${c.method} ${c.path}`);

describe('link commands (server mode)', () => {
    it('link approve shows the request, asks, then approves it', async () => {
        const { h, run, srv } = await serverSetup();
        h.setReaderResponses(true);
        const r = await run('link approve abcd-2345');
        expect(r.err).toBe('');
        expect(r.out).toContain('Terminal     Qodalis CLI on Pixel 7');
        expect(r.out).toContain('Origin       https://cli.example.com');
        expect(r.out).toContain('Address      10.0.0.7');
        expect(r.out).toContain('Permissions  all of yours');
        expect(r.out).toContain("[success] Approved: token 'link Qodalis CLI on Pixel 7' (id tok-9) created for Qodalis CLI on Pixel 7");
        expect(r.out).toContain('Revoke it with: token revoke tok-9');
        expect(linkCalls(srv.calls)).toEqual(['GET /link/code/ABCD-2345', 'POST /link/code/ABCD-2345/approve']);
        expect(srv.calls.find((c) => c.path.endsWith('/approve'))!.auth).toBe('Bearer TOKEN');
    });

    it('link approve shows a scoped request', async () => {
        const { h, run } = await serverSetup({ permissions: ['files:read', 'jobs:read'] });
        h.setReaderResponses(true);
        const r = await run('link approve ABCD2345');
        expect(r.out).toContain('Permissions  files:read, jobs:read');
    });

    it('link approve does nothing when the user declines', async () => {
        const { h, run, srv } = await serverSetup();
        h.setReaderResponses(false);
        const r = await run('link approve ABCD-2345');
        expect(r.out).toContain('[info] Cancelled: the request is still pending');
        expect(linkCalls(srv.calls)).toEqual(['GET /link/code/ABCD-2345']);
        expect(srv.pending.size).toBe(1);
    });

    it('link approve --yes (or -y) does not ask', async () => {
        for (const flag of ['--yes', '-y']) {
            const { run, srv } = await serverSetup();
            // No reader response queued: a question would be answered "no"
            const r = await run(`link approve ABCD-2345 ${flag}`);
            expect(r.out).withContext(flag).toContain('[success] Approved');
            expect(linkCalls(srv.calls)).toEqual(['GET /link/code/ABCD-2345', 'POST /link/code/ABCD-2345/approve']);
        }
    });

    it('link approve takes a code typed with a space', async () => {
        const { run, srv } = await serverSetup();
        await run('link approve abcd 2345 --yes');
        expect(linkCalls(srv.calls)[0]).toBe('GET /link/code/ABCD-2345');
    });

    it('server errors are printed as one line', async () => {
        const { run, srv } = await serverSetup();
        const r = await run('link approve ZZZZ-9999 --yes');
        expect(r.err).toBe('link approve: link request not found or expired');
        expect(r.code).not.toBe(0);
        expect(linkCalls(srv.calls)).toEqual(['GET /link/code/ZZZZ-9999']);

        const notEnabled = await serverSetup({ approveStatus: 501 });
        const r2 = await notEnabled.run('link approve ABCD-2345 --yes');
        expect(r2.err).toBe('link approve: API tokens are not enabled on this server');
        expect((await notEnabled.run('link deny ZZZZ-9999')).err).toBe('link deny: link request not found or expired');
    });

    it('rejects a malformed code without calling the server', async () => {
        const { run, srv } = await serverSetup();
        for (const code of ['ABC', 'ABCD-23456', 'AB!D-2345']) {
            const r = await run(`link approve ${code} --yes`);
            expect(r.err).withContext(code).toContain(`link approve: invalid code '${code}'`);
        }
        expect((await run('link deny nope')).err).toContain("link deny: invalid code 'nope'");
        expect(linkCalls(srv.calls)).toEqual([]);
    });

    it('link deny denies the request', async () => {
        const { run, srv } = await serverSetup();
        const r = await run('link deny abcd-2345');
        expect(r.err).toBe('');
        expect(r.out).toContain('[success] Link request ABCD-2345 denied');
        expect(linkCalls(srv.calls)).toEqual(['POST /link/code/ABCD-2345/deny']);
        expect(srv.pending.size).toBe(0);
    });

    it('link alone prints its usage', async () => {
        const { run } = await serverSetup();
        const r = await run('link');
        expect(r.out).toContain('link approve <code> [--yes]');
        expect(r.out).toContain('link deny <code>');
    });

    it('requires login', async () => {
        const srv = fakeServer();
        const { run } = await harness({ server: 'node' }, srv.http);
        expect((await run('link deny ABCD-2345')).err).toContain('login required');
        expect(linkCalls(srv.calls)).toEqual([]);
    });
});

describe('link commands (local mode)', () => {
    it('print where links are approved', async () => {
        const { run, rt } = await harness({ passwordHashIterations: 1000 });
        await rt.local!.createUserInternal({ name: 'root', email: 'root@localhost', groups: ['admin'], password: 'root', skipPasswordPolicy: true });
        await rt.session.start(await rt.local!.startTrustedSession('root'));
        expect((await run('link approve ABCD-2345')).err).toBe(`link approve: ${LINKS_LOCAL_MESSAGE}`);
        expect((await run('link deny ABCD-2345')).err).toBe(`link deny: ${LINKS_LOCAL_MESSAGE}`);
        expect((await run('link')).err).toBe(`link: ${LINKS_LOCAL_MESSAGE}`);
    });
});

describe('link helpers', () => {
    it('normalizeLinkCode', () => {
        expect(normalizeLinkCode('abcd-2345', 'u')).toBe('ABCD-2345');
        expect(normalizeLinkCode(' abcd 2345 ', 'u')).toBe('ABCD-2345');
        expect(() => normalizeLinkCode(undefined, 'link deny <code>')).toThrowError('usage: link deny <code>');
        expect(() => normalizeLinkCode('', 'u')).toThrowError('usage: u');
        expect(() => normalizeLinkCode('abc', 'u')).toThrowError(/invalid code 'abc'/);
    });

    it('the link command has approve and deny, both needing a value and a login', () => {
        const link = new CliLinkCommandProcessor();
        expect(link.processors.map((p) => p.command)).toEqual(['approve', 'deny']);
        for (const p of link.processors) {
            expect(p.valueRequired).toBeTrue();
            expect(p.metadata?.requireAuth).toBeTrue();
        }
        expect(link.processors[0].parameters!.map((p) => p.name)).toEqual(['yes']);
    });
});

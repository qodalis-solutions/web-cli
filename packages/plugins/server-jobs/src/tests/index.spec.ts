import { ICliCommandProcessor, ICliServerAuthService_TOKEN } from '@qodalis/cli-core';
import { CliJobsCommandProcessor } from '../lib/processors/cli-jobs-command-processor';
import { CliJobNameCompletionProvider } from '../lib/completion/cli-job-name-completion-provider';
import { CliJobsService } from '../lib/services/cli-jobs-service';
import { JobDto } from '../lib/models';

// ── Fakes ───────────────────────────────────────────────────

interface FakeRoute {
    status?: number;
    body?: any;
}

interface RecordedCall {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
}

/** Install a fake fetch keyed by "METHOD url". Unknown routes return 404. */
function installFetch(routes: Record<string, FakeRoute>): RecordedCall[] {
    const calls: RecordedCall[] = [];
    spyOn(window, 'fetch').and.callFake(
        async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = (init?.method ?? 'GET').toUpperCase();
            calls.push({
                method,
                url,
                headers: (init?.headers as Record<string, string>) ?? {},
                body: init?.body ? JSON.parse(String(init.body)) : undefined,
            });
            const route = routes[`${method} ${url}`];
            if (!route) {
                return new Response(JSON.stringify({ error: 'Not found' }), {
                    status: 404,
                    statusText: 'Not Found',
                });
            }
            const text =
                route.body === undefined ? '' : JSON.stringify(route.body);
            return new Response(text, {
                status: route.status ?? 200,
                statusText: route.status && route.status >= 400 ? 'Error' : 'OK',
            });
        },
    );
    return calls;
}

interface FakeServer {
    name: string;
    url: string;
    connected?: boolean;
    headers?: Record<string, string>;
}

function createContext(
    servers: FakeServer[],
    opts: { authService?: any; readLines?: (string | null)[]; confirm?: boolean } = {},
) {
    const connections = new Map<string, any>();
    for (const s of servers) {
        connections.set(s.name, {
            connected: s.connected ?? true,
            config: { name: s.name, url: s.url, headers: s.headers },
        });
    }
    const manager = { connections };
    const resolve = (token: any) => {
        if (token === 'cli-server-manager') return manager;
        if (token === ICliServerAuthService_TOKEN) return opts.authService;
        return undefined;
    };

    const out = {
        info: [] as string[],
        success: [] as string[],
        error: [] as string[],
        lines: [] as string[],
        tables: [] as { headers: string[]; rows: string[][] }[],
    };
    const readLines = [...(opts.readLines ?? [])];

    const context: any = {
        services: { get: resolve, getRequired: resolve },
        writer: {
            writeln: (t = '') => out.lines.push(t),
            write: (t: string) => out.lines.push(t),
            writeInfo: (t: string) => out.info.push(t),
            writeSuccess: (t: string) => out.success.push(t),
            writeError: (t: string) => out.error.push(t),
            writeWarning: (t: string) => out.info.push(t),
            writeTable: (headers: string[], rows: string[][]) =>
                out.tables.push({ headers, rows }),
            wrapInColor: (t: string) => t,
        },
        reader: {
            readLine: async () => (readLines.length ? readLines.shift()! : ''),
            readConfirm: async () => opts.confirm ?? true,
        },
    };
    return { context, out };
}

function jobsProcessor(): ICliCommandProcessor {
    const root = new CliJobsCommandProcessor();
    return root.processors![0];
}

function sub(name: string): ICliCommandProcessor {
    const found = jobsProcessor().processors!.find((p) => p.command === name);
    if (!found) throw new Error(`No sub-command ${name}`);
    return found;
}

async function run(
    name: string,
    context: any,
    value?: string,
    args: Record<string, any> = {},
) {
    await sub(name).processCommand(
        { command: name, value, args, chainCommands: [], rawCommand: '' } as any,
        context,
    );
}

const BASE = 'http://srv1.test/api/v1/qcli/jobs';
const BASE2 = 'http://srv2.test/api/v1/qcli/jobs';

const JOB: JobDto = {
    id: 'job-1',
    name: 'Cleanup',
    description: 'Removes temp files',
    group: 'maintenance',
    status: 'active',
    schedule: '*/5 * * * *',
    maxRetries: 3,
    overlapPolicy: 'skip',
};

const OTHER: JobDto = {
    ...JOB,
    id: 'job-2',
    name: 'Report',
    group: 'reports',
    status: 'paused',
    schedule: undefined,
    interval: 60000,
};

// ── Structure ───────────────────────────────────────────────

describe('CliJobsCommandProcessor structure', () => {
    it('extends the "server" command with a "jobs" sub-command', () => {
        const p = new CliJobsCommandProcessor();
        expect(p.command).toBe('server');
        expect(p.extendsProcessor).toBeTrue();
        expect(p.processors!.length).toBe(1);
        expect(p.processors![0].command).toBe('jobs');
    });

    it('exposes all job sub-commands', () => {
        const names = jobsProcessor().processors!.map((p) => p.command);
        expect(names).toEqual([
            'list',
            'info',
            'trigger',
            'pause',
            'resume',
            'stop',
            'cancel',
            'history',
            'logs',
            'edit',
            'watch',
        ]);
    });

    it('requires a value for job-targeting sub-commands and accepts --server everywhere', () => {
        for (const p of jobsProcessor().processors!) {
            const params = (p.parameters ?? []).map((x) => x.name);
            expect(params).toContain('server');
            if (p.command === 'list' || p.command === 'watch') {
                expect(p.valueRequired).toBeFalsy();
            } else {
                expect(p.valueRequired).toBeTrue();
            }
        }
        expect(sub('list').aliases).toContain('ls');
    });
});

// ── HTTP behaviour ──────────────────────────────────────────

describe('server jobs sub-commands', () => {
    it('list fetches jobs from every connected server and renders a table', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [JOB, OTHER] },
            [`GET ${BASE2}`]: { body: [] },
        });
        const { context, out } = createContext([
            { name: 'one', url: 'http://srv1.test/' },
            { name: 'two', url: 'http://srv2.test' },
            { name: 'off', url: 'http://srv3.test', connected: false },
        ]);

        await run('list', context);

        expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
            `GET ${BASE}`,
            `GET ${BASE2}`,
        ]);
        expect(out.lines).toContain('Server: one');
        expect(out.lines).toContain('Server: two');
        expect(out.tables.length).toBe(1);
        expect(out.tables[0].rows.map((r) => r[0])).toEqual(['Cleanup', 'Report']);
        expect(out.tables[0].rows[1][3]).toBe('every 60000ms');
        expect(out.info).toContain('  No jobs found.');
    });

    it('list --server targets only the named server and --group filters', async () => {
        const calls = installFetch({
            [`GET ${BASE2}`]: { body: [JOB, OTHER] },
        });
        const { context, out } = createContext([
            { name: 'one', url: 'http://srv1.test' },
            { name: 'two', url: 'http://srv2.test' },
        ]);

        await run('list', context, undefined, { server: 'two', group: 'REPORTS' });

        expect(calls.length).toBe(1);
        expect(calls[0].url).toBe(BASE2);
        expect(out.tables[0].rows.map((r) => r[0])).toEqual(['Report']);
        expect(out.lines).not.toContain('Server: two');
    });

    it('list reports when there are no connected servers', async () => {
        const calls = installFetch({});
        const { context, out } = createContext([
            { name: 'one', url: 'http://srv1.test', connected: false },
        ]);

        await run('list', context);

        expect(calls.length).toBe(0);
        expect(out.info[0]).toContain('No connected servers');
    });

    it('list reports server errors using the error body', async () => {
        installFetch({
            [`GET ${BASE}`]: { status: 500, body: { error: 'boom' } },
        });
        const { context, out } = createContext([
            { name: 'one', url: 'http://srv1.test' },
        ]);

        await run('list', context);

        expect(out.error).toEqual(['Failed to list jobs on one: boom']);
    });

    it('sends config headers and auth-service headers with requests', async () => {
        const calls = installFetch({ [`GET ${BASE}`]: { body: [] } });
        const { context } = createContext(
            [{ name: 'one', url: 'http://srv1.test', headers: { 'X-Api-Key': 'k' } }],
        );
        await run('list', context);
        expect(calls[0].headers['X-Api-Key']).toBe('k');
        expect(calls[0].headers['Content-Type']).toBe('application/json');

        const authService = {
            getHeaders: (server: string) => ({ Authorization: `Bearer ${server}` }),
        };
        const { context: authCtx } = createContext(
            [{ name: 'one', url: 'http://srv1.test' }],
            { authService },
        );
        await run('list', authCtx);
        expect(calls[1].headers['Authorization']).toBe('Bearer one');
    });

    it('info resolves a job by name (case-insensitive) and prints its details', async () => {
        installFetch({ [`GET ${BASE}`]: { body: [JOB, OTHER] } });
        const { context, out } = createContext([
            { name: 'one', url: 'http://srv1.test' },
        ]);

        await run('info', context, 'cleanup');

        const text = out.lines.join('\n');
        expect(text).toContain('job-1');
        expect(text).toContain('Removes temp files');
        expect(text).toContain('*/5 * * * *');
        expect(out.error.length).toBe(0);
    });

    it('info fetches a UUID-like id directly', async () => {
        const id = '0b9c2a6e-1111-2222-3333-444455556666';
        const calls = installFetch({
            [`GET ${BASE}/${id}`]: { body: { ...JOB, id } },
        });
        const { context, out } = createContext([
            { name: 'one', url: 'http://srv1.test' },
        ]);

        await run('info', context, id);

        expect(calls.length).toBe(1);
        expect(calls[0].url).toBe(`${BASE}/${id}`);
        expect(out.lines.join('\n')).toContain(id);
    });

    it('info reports an unknown job and missing value', async () => {
        installFetch({ [`GET ${BASE}`]: { body: [JOB] } });
        const { context, out } = createContext([
            { name: 'one', url: 'http://srv1.test' },
        ]);

        await run('info', context, 'nope');
        await run('info', context, '  ');

        expect(out.error.length).toBe(2);
        expect(out.error[0]).toBe('Job "nope" not found on server one.');
        expect(out.error[1]).toContain('Usage:');
    });

    it('reports a job missing on every connected server once', async () => {
        installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`GET ${BASE2}`]: { body: [OTHER] },
        });
        const { context, out } = createContext([
            { name: 'one', url: 'http://srv1.test' },
            { name: 'two', url: 'http://srv2.test' },
        ]);

        await run('info', context, 'nope');
        await run('trigger', context, 'nope');
        await run('info', context, 'Report');

        expect(out.error).toEqual([
            'Job "nope" not found on any of the 2 connected servers.',
            'Job "nope" not found on any of the 2 connected servers.',
        ]);
        expect(out.lines.join('\n')).toContain('job-2');
    });

    const actions: [string, string][] = [
        ['trigger', 'triggered'],
        ['pause', 'paused'],
        ['resume', 'resumed'],
        ['cancel', 'cancelled'],
        ['stop', 'stopped'],
    ];

    for (const [action, pastTense] of actions) {
        it(`${action} POSTs to /<id>/${action}`, async () => {
            const calls = installFetch({
                [`GET ${BASE}`]: { body: [JOB] },
                [`POST ${BASE}/job-1/${action}`]: {},
            });
            const { context, out } = createContext([
                { name: 'one', url: 'http://srv1.test' },
            ]);

            await run(action, context, 'Cleanup');

            expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
                `GET ${BASE}`,
                `POST ${BASE}/job-1/${action}`,
            ]);
            expect(out.success).toEqual([`Job "Cleanup" ${pastTense}.`]);
        });
    }

    it('actions only hit the server selected with --server and suffix the server name with multiple servers', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [] },
            [`GET ${BASE2}`]: { body: [JOB] },
            [`POST ${BASE2}/job-1/trigger`]: {},
        });
        const servers = [
            { name: 'one', url: 'http://srv1.test' },
            { name: 'two', url: 'http://srv2.test' },
        ];

        const { context, out } = createContext(servers);
        await run('trigger', context, 'Cleanup');
        expect(out.success).toEqual(['Job "Cleanup" triggered on server two.']);

        calls.length = 0;
        const { context: ctx2 } = createContext(servers);
        await run('trigger', ctx2, 'Cleanup', { server: 'two' });
        expect(calls.every((c) => c.url.startsWith('http://srv2.test'))).toBeTrue();
    });

    it('actions report failures from the server', async () => {
        installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`POST ${BASE}/job-1/pause`]: { status: 409, body: { error: 'already paused' } },
        });
        const { context, out } = createContext([
            { name: 'one', url: 'http://srv1.test' },
        ]);

        await run('pause', context, 'Cleanup');

        expect(out.error).toEqual(['Failed to pause job on one: already paused']);
        expect(out.success.length).toBe(0);
    });

    it('history passes limit, offset and status as query parameters', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`GET ${BASE}/job-1/history?limit=5&offset=10&status=failed`]: {
                body: {
                    items: [
                        {
                            id: 'exec-123456789',
                            jobId: 'job-1',
                            jobName: 'Cleanup',
                            status: 'failed',
                            startedAt: new Date().toISOString(),
                            duration: 1500,
                            retryAttempt: 1,
                            error: 'disk full',
                        },
                    ],
                    total: 7,
                    limit: 5,
                    offset: 10,
                },
            },
        });
        const { context, out } = createContext([
            { name: 'one', url: 'http://srv1.test' },
        ]);

        await run('history', context, 'Cleanup', {
            limit: 5,
            offset: 10,
            status: 'failed',
        });

        expect(calls[1].url).toBe(
            `${BASE}/job-1/history?limit=5&offset=10&status=failed`,
        );
        expect(out.lines).toContain('Showing 1 of 7 executions for "Cleanup":');
        expect(out.tables[0].rows[0]).toEqual([
            'exec-123',
            'failed',
            jasmine.any(String) as any,
            '1.5s',
            '1',
            'disk full',
        ]);
    });

    it('logs fetches the latest execution and prints its log entries', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`GET ${BASE}/job-1/history?limit=1`]: {
                body: { items: [{ id: 'exec-abc' }], total: 1, limit: 1, offset: 0 },
            },
            [`GET ${BASE}/job-1/history/exec-abc`]: {
                body: {
                    id: 'exec-abc',
                    status: 'completed',
                    logs: [
                        { timestamp: new Date().toISOString(), level: 'info', message: 'hello log' },
                    ],
                },
            },
        });
        const { context, out } = createContext([
            { name: 'one', url: 'http://srv1.test' },
        ]);

        await run('logs', context, 'Cleanup');

        expect(calls.map((c) => c.url)).toEqual([
            BASE,
            `${BASE}/job-1/history?limit=1`,
            `${BASE}/job-1/history/exec-abc`,
        ]);
        expect(out.lines.some((l) => l.includes('hello log'))).toBeTrue();
    });

    it('logs --exec fetches that execution directly', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`GET ${BASE}/job-1/history/exec-xyz`]: {
                body: { id: 'exec-xyz', status: 'failed', logs: [] },
            },
        });
        const { context, out } = createContext([
            { name: 'one', url: 'http://srv1.test' },
        ]);

        await run('logs', context, 'Cleanup', { exec: 'exec-xyz' });

        expect(calls.length).toBe(2);
        expect(calls[1].url).toBe(`${BASE}/job-1/history/exec-xyz`);
        expect(out.info).toContain('  No log entries.');
    });

    it('edit PUTs only the changed fields after confirmation', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`PUT ${BASE}/job-1`]: {},
        });
        // description, group, schedule (empty -> interval asked), interval,
        // retries, timeout, overlap policy
        const { context, out } = createContext(
            [{ name: 'one', url: 'http://srv1.test' }],
            { readLines: ['New desc', '', '', '30s', '5', '', 'QUEUE'], confirm: true },
        );

        await run('edit', context, 'Cleanup');

        const put = calls.find((c) => c.method === 'PUT')!;
        expect(put.url).toBe(`${BASE}/job-1`);
        expect(put.body).toEqual({
            description: 'New desc',
            interval: '30s',
            maxRetries: 5,
            overlapPolicy: 'queue',
        });
        expect(out.success).toEqual(['Job "Cleanup" updated successfully.']);
    });

    it('edit makes no request when nothing changed or the user declines', async () => {
        const calls = installFetch({ [`GET ${BASE}`]: { body: [JOB] } });

        const { context, out } = createContext(
            [{ name: 'one', url: 'http://srv1.test' }],
            { readLines: [] },
        );
        await run('edit', context, 'Cleanup');
        expect(out.info).toContain('No changes made.');

        const { context: ctx2, out: out2 } = createContext(
            [{ name: 'one', url: 'http://srv1.test' }],
            { readLines: ['changed'], confirm: false },
        );
        await run('edit', ctx2, 'Cleanup');
        expect(out2.info).toContain('Edit cancelled.');

        expect(calls.some((c) => c.method === 'PUT')).toBeFalse();
    });
});

// ── Service ─────────────────────────────────────────────────

describe('CliJobsService', () => {
    it('falls back to "<status> <statusText>" when the error body has no message', async () => {
        spyOn(window, 'fetch').and.resolveTo(
            new Response('not json', { status: 503, statusText: 'Unavailable' }),
        );
        const service = new CliJobsService('http://srv1.test');
        await expectAsync(service.listJobs()).toBeRejectedWithError(
            '503 Unavailable',
        );
    });

    it('URL-encodes job ids', async () => {
        const calls = installFetch({});
        const service = new CliJobsService('http://srv1.test');
        await expectAsync(service.getJob('a b/c')).toBeRejected();
        expect(calls[0].url).toBe(`${BASE}/a%20b%2Fc`);
    });
});

// ── Completion ──────────────────────────────────────────────

describe('CliJobNameCompletionProvider', () => {
    it('suggests matching job names for job-targeting sub-commands', async () => {
        installFetch({ [`GET ${BASE}`]: { body: [JOB, OTHER] } });
        const { context } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        const provider = new CliJobNameCompletionProvider();
        provider.setServices(context.services);

        const result = await provider.getCompletions({
            tokens: ['server', 'jobs', 'trigger', 're'],
            tokenIndex: 3,
            token: 're',
        } as any);
        expect(result).toEqual(['Report']);

        const none = await provider.getCompletions({
            tokens: ['server', 'jobs', 'list', ''],
            tokenIndex: 3,
            token: '',
        } as any);
        expect(none).toEqual([]);
    });
});

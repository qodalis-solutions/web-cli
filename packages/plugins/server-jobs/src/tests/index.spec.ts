import { ICliCommandProcessor, ICliServerAuthService_TOKEN } from '@qodalis/cli-core';
import { Subject } from 'rxjs';
import {
    CliJobsCommandProcessor,
    formatRate,
    parseRunsLimit,
    resolveRunId,
} from '../lib/processors/cli-jobs-command-processor';
import { CliJobNameCompletionProvider } from '../lib/completion/cli-job-name-completion-provider';
import { CliJobsService } from '../lib/services/cli-jobs-service';
import { JobDto, JobExecutionDto, JobStatsResponse } from '../lib/models';

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
    opts: { authService?: any; readLines?: (string | null)[]; confirm?: boolean | null } = {},
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
    const onAbort = new Subject<void>();
    const abortController = new AbortController();

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
            readConfirm: async () => ('confirm' in opts ? opts.confirm : true),
        },
        onAbort,
        signal: abortController.signal,
    };
    return { context, out, onAbort, abortController };
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
            'runs',
            'stats',
            'watch',
        ]);
    });

    it('requires a value for job-targeting sub-commands and accepts --server everywhere', () => {
        for (const p of jobsProcessor().processors!) {
            const params = (p.parameters ?? []).map((x) => x.name);
            expect(params).toContain('server');
            if (['list', 'watch', 'runs', 'stats'].includes(p.command)) {
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
        expect(out.tables[0].rows[1][3]).toBe('every 1m');
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
            { readLines: ['New desc', '', '', '', '30s', '5', '', 'QUEUE'], confirm: true },
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

    it('edit sets max concurrent runs', async () => {
        // description, group, schedule, interval, retries, timeout, overlap policy, max concurrent runs
        const calls = installFetch({ [`GET ${BASE}`]: { body: [JOB] }, [`PUT ${BASE}/job-1`]: {} });
        const { context } = createContext(
            [{ name: 'one', url: 'http://srv1.test' }],
            { readLines: ['', '', '', '', '', '', '', '', '3'], confirm: true },
        );
        await run('edit', context, 'Cleanup');
        expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({ maxConcurrentRuns: 3 });
    });

    it('edit keeps max concurrent runs when the answer is not a whole number of at least 1', async () => {
        const calls2 = installFetch({ [`GET ${BASE}`]: { body: [JOB] } });
        const { context: ctx2, out: out2 } = createContext(
            [{ name: 'one', url: 'http://srv1.test' }],
            { readLines: ['', '', '', '', '', '', '', '', '0'], confirm: true },
        );
        await run('edit', ctx2, 'Cleanup');
        expect(out2.info.join('\n')).toContain('Max concurrent runs must be a whole number of at least 1');
        expect(out2.info).toContain('No changes made.');
        expect(calls2.some((c) => c.method === 'PUT')).toBeFalse();
    });

    it('info shows intervals and timeouts in either form, and the runs going now', async () => {
        installFetch({
            [`GET ${BASE}`]: {
                body: [
                    { ...JOB, schedule: undefined, interval: 300000, timeout: '2m', maxConcurrentRuns: 3, currentExecutionId: 'e2', runningExecutionIds: ['e1', 'e2'], queued: true },
                    { ...OTHER, schedule: undefined, interval: '30s' },
                ],
            },
        });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        await run('info', context, 'cleanup');
        const text = out.lines.join('\n');
        expect(text).toContain('every 5m');
        expect(text).toContain('2m');
        expect(text).not.toContain('ms');
        expect(text).toMatch(/Max Concurrent Runs\s+3/);
        expect(text).toContain('2/3 running, 1 queued: e1, e2');
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

// ── Several servers ─────────────────────────────────────────

describe('server jobs with several servers', () => {
    const servers = [
        { name: 'one', url: 'http://srv1.test' },
        { name: 'two', url: 'http://srv2.test' },
    ];

    it('actions apply to every server that has the job and say it is on several', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`GET ${BASE2}`]: { body: [{ ...JOB, id: 'job-9' }] },
            [`POST ${BASE}/job-1/trigger`]: {},
            [`POST ${BASE2}/job-9/trigger`]: {},
        });
        const { context, out } = createContext(servers);

        await run('trigger', context, 'cleanup');

        expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual([
            `${BASE}/job-1/trigger`,
            `${BASE2}/job-9/trigger`,
        ]);
        expect(out.success).toEqual([
            'Job "Cleanup" triggered on server one.',
            'Job "Cleanup" triggered on server two.',
        ]);
        expect(out.info.length).toBe(1);
        expect(out.info[0]).toContain('is on 2 servers (one, two)');
        expect(out.info[0]).toContain('--server');
        expect(out.error).toEqual([]);
    });

    it('a failure on one server does not stop the action on the others', async () => {
        installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`GET ${BASE2}`]: { body: [JOB] },
            [`POST ${BASE}/job-1/stop`]: { status: 500, body: { error: 'boom' } },
            [`POST ${BASE2}/job-1/stop`]: {},
        });
        const { context, out } = createContext(servers);

        await run('stop', context, 'Cleanup');

        expect(out.error).toEqual(['Failed to stop job on one: boom']);
        expect(out.success).toEqual(['Job "Cleanup" stopped on server two.']);
    });

    it('--server limits an action to one server even when both have the job', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`GET ${BASE2}`]: { body: [JOB] },
            [`POST ${BASE2}/job-1/pause`]: {},
        });
        const { context, out } = createContext(servers);

        await run('pause', context, 'Cleanup', { server: 'two' });

        expect(calls.every((c) => c.url.startsWith('http://srv2.test'))).toBeTrue();
        expect(out.success).toEqual(['Job "Cleanup" paused.']);
        expect(out.info).toEqual([]);
    });

    it('reports a lookup error and the servers that lack the job', async () => {
        installFetch({
            [`GET ${BASE}`]: { status: 500, body: { error: 'down' } },
            [`GET ${BASE2}`]: { body: [OTHER] },
        });
        const { context, out } = createContext(servers);

        await run('resume', context, 'Cleanup');

        expect(out.error).toEqual([
            'Error on server one: down',
            'Job "Cleanup" not found on server two.',
        ]);
        expect(out.success).toEqual([]);
    });

    it('info shows the job of every server that has it', async () => {
        installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`GET ${BASE2}`]: { body: [{ ...JOB, id: 'job-9' }] },
        });
        const { context, out } = createContext(servers);

        await run('info', context, 'Cleanup');

        expect(out.lines).toContain('Server: one');
        expect(out.lines).toContain('Server: two');
        const text = out.lines.join('\n');
        expect(text).toContain('job-1');
        expect(text).toContain('job-9');
    });

    it('prefers an exact name over a case-insensitive one', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [{ ...JOB, id: 'job-lower', name: 'cleanup' }, JOB] },
            [`POST ${BASE}/job-1/trigger`]: {},
        });
        const { context } = createContext([servers[0]]);

        await run('trigger', context, 'Cleanup');

        expect(calls[1].url).toBe(`${BASE}/job-1/trigger`);
    });

    it('edit asks for --server when several servers have the job', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`GET ${BASE2}`]: { body: [JOB] },
        });
        const { context, out } = createContext(servers, { readLines: ['x'] });

        await run('edit', context, 'Cleanup');

        expect(out.error.length).toBe(1);
        expect(out.error[0]).toContain('--server');
        expect(calls.some((c) => c.method === 'PUT')).toBeFalse();
    });
});

// ── Tags ────────────────────────────────────────────────────

describe('server jobs tags', () => {
    const TAGGED: JobDto = { ...JOB, tags: ['country:ro', 'bank'] };

    it('list --tag sends every tag to the server and shows a Tags column', async () => {
        const calls = installFetch({
            [`GET ${BASE}?tag=country%3Aro&tag=bank`]: { body: [TAGGED] },
        });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);

        await run('list', context, undefined, { tag: ['country:ro', 'bank'] });

        expect(calls.map((c) => c.url)).toEqual([`${BASE}?tag=country%3Aro&tag=bank`]);
        expect(out.tables[0].headers).toContain('Tags');
        expect(out.tables[0].rows[0][2]).toBe('country:ro, bank');
    });

    it('list --tag accepts comma-separated tags and filters an older server that ignores ?tag=', async () => {
        installFetch({
            [`GET ${BASE}?tag=Bank&tag=country%3Aro`]: { body: [TAGGED, OTHER] },
        });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);

        await run('list', context, undefined, { tag: ['Bank,country:ro'] });

        expect(out.tables[0].rows.map((r) => r[0])).toEqual(['Cleanup']);
    });

    it('list has no Tags column when no job has tags', async () => {
        installFetch({ [`GET ${BASE}`]: { body: [JOB, OTHER] } });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);

        await run('list', context);

        expect(out.tables[0].headers).not.toContain('Tags');
    });

    it('edit "-" clears the tags', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [TAGGED] },
            [`PUT ${BASE}/job-1`]: {},
        });
        const { context } = createContext([{ name: 'one', url: 'http://srv1.test' }], {
            readLines: ['', '', '-'],
            confirm: true,
        });

        await run('edit', context, 'Cleanup');

        expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({ tags: null });
    });
});

// ── Edit cancellation ───────────────────────────────────────

describe('server jobs edit cancellation', () => {
    // description, group, tags, schedule (empty -> interval), interval, retries,
    // timeout, overlap policy
    const answers = ['New desc', 'grp', 'a, b,a', '', '30s', '5', '1m', 'queue'];

    for (let i = 0; i < answers.length; i++) {
        it(`Ctrl+C at prompt ${i + 1} cancels without sending changes`, async () => {
            const calls = installFetch({
                [`GET ${BASE}`]: { body: [JOB] },
                [`PUT ${BASE}/job-1`]: {},
            });
            const readLines: (string | null)[] = [...answers.slice(0, i), null, ...answers.slice(i + 1)];
            const { context, out } = createContext(
                [{ name: 'one', url: 'http://srv1.test' }],
                { readLines, confirm: true },
            );

            await run('edit', context, 'Cleanup');

            expect(calls.some((c) => c.method === 'PUT')).toBeFalse();
            expect(out.info).toContain('Edit cancelled.');
            expect(out.success).toEqual([]);
        });
    }

    it('Ctrl+C at the confirmation cancels', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`PUT ${BASE}/job-1`]: {},
        });
        const { context, out } = createContext(
            [{ name: 'one', url: 'http://srv1.test' }],
            { readLines: ['New desc'], confirm: null },
        );

        await run('edit', context, 'Cleanup');

        expect(calls.some((c) => c.method === 'PUT')).toBeFalse();
        expect(out.info).toContain('Edit cancelled.');
    });

    it('an aborted signal cancels even if the reader answers', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`PUT ${BASE}/job-1`]: {},
        });
        const { context, out, abortController } = createContext(
            [{ name: 'one', url: 'http://srv1.test' }],
            { confirm: true },
        );
        context.reader.readLine = async () => {
            abortController.abort();
            return 'typed';
        };

        await run('edit', context, 'Cleanup');

        expect(calls.some((c) => c.method === 'PUT')).toBeFalse();
        expect(out.info).toContain('Edit cancelled.');
    });

    it('all answers given still sends the update', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`PUT ${BASE}/job-1`]: {},
        });
        const { context, out } = createContext(
            [{ name: 'one', url: 'http://srv1.test' }],
            { readLines: answers, confirm: true },
        );

        await run('edit', context, 'Cleanup');

        const put = calls.find((c) => c.method === 'PUT')!;
        expect(put.body).toEqual({
            description: 'New desc',
            group: 'grp',
            tags: ['a', 'b', 'a'],
            interval: '30s',
            maxRetries: 5,
            timeout: '1m',
            overlapPolicy: 'queue',
        });
        expect(out.success).toEqual(['Job "Cleanup" updated successfully.']);
    });
});

// ── Watch ───────────────────────────────────────────────────

class FakeWebSocket {
    static instances: FakeWebSocket[] = [];
    onmessage: ((e: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: (() => void) | null = null;
    closed = false;

    constructor(public url: string) {
        FakeWebSocket.instances.push(this);
    }

    close(): void {
        this.closed = true;
    }

    /** The server ends the connection. */
    serverClose(): void {
        this.closed = true;
        this.onclose?.();
    }

    emit(data: any): void {
        this.onmessage?.({ data: JSON.stringify(data) });
    }
}

async function waitFor(check: () => boolean): Promise<void> {
    for (let i = 0; i < 100 && !check(); i++) {
        await new Promise((r) => setTimeout(r, 1));
    }
    expect(check()).toBeTrue();
}

describe('server jobs watch', () => {
    let originalWebSocket: any;

    beforeEach(() => {
        originalWebSocket = (window as any).WebSocket;
        (window as any).WebSocket = FakeWebSocket;
        FakeWebSocket.instances = [];
    });

    afterEach(() => {
        (window as any).WebSocket = originalWebSocket;
    });

    const servers = [
        { name: 'one', url: 'https://srv1.test/' },
        { name: 'two', url: 'http://srv2.test' },
    ];

    it('prints job events and stops on Ctrl+C (onAbort), closing sockets and unsubscribing', async () => {
        const { context, out, onAbort } = createContext(servers);
        const removeSpy = spyOn(context.signal, 'removeEventListener').and.callThrough();

        let finished = false;
        const watching = run('watch', context).then(() => (finished = true));
        await waitFor(() => FakeWebSocket.instances.length === 2);

        const [ws1, ws2] = FakeWebSocket.instances;
        expect(ws1.url).toBe('wss://srv1.test/ws/v1/qcli/events');
        expect(ws2.url).toBe('ws://srv2.test/ws/v1/qcli/events');

        ws1.emit({ type: 'job:completed', jobId: 'job-1', duration: 1500 });
        ws1.emit({ type: 'other:event' });
        expect(out.lines.some((l) => l.includes('[one] completed jobId=job-1 duration=1.5s'))).toBeTrue();
        expect(out.lines.filter((l) => l.includes('other')).length).toBe(0);

        expect(finished).toBeFalse();
        onAbort.next();
        await watching;

        expect(ws1.closed && ws2.closed).toBeTrue();
        expect(ws1.onmessage).toBeNull();
        expect(onAbort.observed).toBeFalse();
        expect(removeSpy).toHaveBeenCalledWith('abort', jasmine.any(Function));
        expect(out.info).toContain('Stopped watching job events.');
    });

    it('stops when the abort signal fires', async () => {
        const { context, out, onAbort, abortController } = createContext([servers[1]]);
        const watching = run('watch', context);
        await waitFor(() => FakeWebSocket.instances.length === 1);

        abortController.abort();
        await watching;

        expect(FakeWebSocket.instances[0].closed).toBeTrue();
        expect(onAbort.observed).toBeFalse();
        expect(out.info).toContain('Stopped watching job events.');
    });

    it('ends when every server closes its connection', async () => {
        const { context, out, onAbort } = createContext(servers);
        let finished = false;
        const watching = run('watch', context).then(() => (finished = true));
        await waitFor(() => FakeWebSocket.instances.length === 2);

        FakeWebSocket.instances[0].serverClose();
        await new Promise((r) => setTimeout(r, 5));
        expect(finished).toBeFalse();

        FakeWebSocket.instances[1].serverClose();
        await watching;

        expect(out.info).toContain('Connection to server one closed.');
        expect(out.info).toContain('Connection to server two closed.');
        expect(out.info).toContain('Stopped watching job events: no server connection left.');
        expect(onAbort.observed).toBeFalse();
    });

    it('returns at once when the target server is not connected', async () => {
        const { context, out } = createContext(servers);

        await run('watch', context, undefined, { server: 'nope' });

        expect(FakeWebSocket.instances.length).toBe(0);
        expect(out.info).toEqual(['Server "nope" is not connected.']);
    });

    it('returns at once when already aborted', async () => {
        const { context, abortController, onAbort } = createContext(servers);
        abortController.abort();

        await run('watch', context);

        expect(FakeWebSocket.instances.length).toBe(0);
        expect(onAbort.observed).toBeFalse();
    });

    it('ends when no socket could be opened', async () => {
        (window as any).WebSocket = class {
            constructor() {
                throw new Error('refused');
            }
        };
        const { context, out } = createContext([servers[1]]);

        await run('watch', context);

        expect(out.error).toEqual(['Failed to connect to two: refused']);
        expect(out.info).toContain('Stopped watching job events: no server connection left.');
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

// ── runs / stats / history clear / history rm ───────────────

const RUN_A: JobExecutionDto = {
    id: 'aaaa1111-0000-0000-0000-000000000001',
    jobId: 'job-1',
    jobName: 'Cleanup',
    status: 'failed',
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    duration: 1500,
    error: 'disk full',
    retryAttempt: 1,
    logCount: 3,
};

const RUN_B: JobExecutionDto = {
    ...RUN_A,
    id: 'bbbb2222-0000-0000-0000-000000000002',
    jobId: 'job-2',
    jobName: 'Report',
    status: 'completed',
    error: undefined,
    retryAttempt: 0,
};

function runsPage(items: JobExecutionDto[], total = items.length) {
    return { items, total, limit: 20, offset: 0 };
}

describe('server jobs runs', () => {
    it('lists the latest runs of every job with the default limit', async () => {
        const calls = installFetch({
            [`GET ${BASE}/executions?limit=20`]: { body: runsPage([RUN_A, RUN_B], 42) },
        });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);

        await run('runs', context);

        expect(calls.map((c) => c.url)).toEqual([`${BASE}/executions?limit=20`]);
        expect(out.lines).toContain('Showing 2 of 42 runs:');
        expect(out.tables[0].headers).toEqual(['Job', 'ID', 'Status', 'Started', 'Duration', 'Retry', 'Error']);
        expect(out.tables[0].rows[0]).toEqual(['Cleanup', 'aaaa1111', 'failed', '1m ago', '1.5s', '1', 'disk full']);
        expect(out.tables[0].rows[1][0]).toBe('Report');
        expect(out.error).toEqual([]);
    });

    it('--job resolves the name to the ID, --status and -n go to the server', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [JOB, OTHER] },
            [`GET ${BASE}/executions?job=job-1&status=failed&limit=5`]: { body: runsPage([RUN_A]) },
        });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);

        await run('runs', context, undefined, { job: 'cleanup', status: 'failed', n: 5 });

        expect(calls.map((c) => c.url)).toEqual([BASE, `${BASE}/executions?job=job-1&status=failed&limit=5`]);
        expect(out.tables[0].rows.length).toBe(1);
    });

    it('accepts --limit as the long form of -n', async () => {
        const calls = installFetch({
            [`GET ${BASE}/executions?limit=100`]: { body: runsPage([]) },
        });
        const { context } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        await run('runs', context, undefined, { limit: '100' });
        expect(calls[0].url).toBe(`${BASE}/executions?limit=100`);
    });

    it('says so when there are no runs', async () => {
        installFetch({ [`GET ${BASE}/executions?limit=20`]: { body: runsPage([]) } });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        await run('runs', context);
        expect(out.info).toEqual(['No runs found.']);
        expect(out.tables.length).toBe(0);
    });

    it('reports a server error', async () => {
        installFetch({ [`GET ${BASE}/executions?limit=20`]: { status: 403, body: { error: 'forbidden' } } });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        await run('runs', context);
        expect(out.error).toEqual(['Failed to list runs on one: forbidden']);
    });

    it('rejects a bad -n, an unknown status and an empty --job without calling the server', async () => {
        const calls = installFetch({});
        for (const args of [{ n: 0 }, { n: 101 }, { n: 'abc' }, { n: 2.5 }, { status: 'weird' }, { job: true }, { job: ' ' }]) {
            const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
            await run('runs', context, undefined, args);
            expect(out.error.length).withContext(JSON.stringify(args)).toBe(1);
        }
        expect(calls.length).toBe(0);
    });

    it('reports a --job that no server has', async () => {
        installFetch({ [`GET ${BASE}`]: { body: [JOB] } });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        await run('runs', context, undefined, { job: 'missing' });
        expect(out.error).toEqual(['Job "missing" not found on server one.']);
        expect(out.tables.length).toBe(0);
    });

    it('shows each server under its header and says when none is connected', async () => {
        installFetch({
            [`GET ${BASE}/executions?limit=20`]: { body: runsPage([RUN_A]) },
            [`GET ${BASE2}/executions?limit=20`]: { body: runsPage([]) },
        });
        const { context, out } = createContext([
            { name: 'one', url: 'http://srv1.test' },
            { name: 'two', url: 'http://srv2.test' },
        ]);
        await run('runs', context);
        expect(out.lines).toContain('Server: one');
        expect(out.lines).toContain('Server: two');
        expect(out.info).toEqual(['No runs found.']);

        const none = createContext([]);
        await run('runs', none.context);
        expect(none.out.info).toEqual(['No connected servers.']);
    });
});

const STATS: JobStatsResponse = {
    since: '2026-11-24T10:00:00.000Z',
    until: '2026-11-25T10:00:00.000Z',
    bucketMs: 3_600_000,
    buckets: [],
    totals: {
        total: 10,
        succeeded: 8,
        failed: 1,
        cancelled: 1,
        running: 0,
        successRate: 0.8,
        avgDuration: 1200,
        p95Duration: 3000,
        maxDuration: 4000,
        lastFailureAt: null,
    },
    jobs: [
        {
            jobId: 'job-1',
            jobName: 'Cleanup',
            total: 10,
            succeeded: 8,
            failed: 1,
            cancelled: 1,
            running: 0,
            successRate: 0.8,
            avgDuration: 1200,
            p95Duration: 3000,
            maxDuration: 4000,
            lastFailureAt: null,
            recent: [],
        },
        {
            jobId: 'job-2',
            jobName: 'Report',
            total: 0,
            succeeded: 0,
            failed: 0,
            cancelled: 0,
            running: 0,
            successRate: null,
            avgDuration: null,
            p95Duration: null,
            maxDuration: null,
            lastFailureAt: null,
            recent: [],
        },
    ],
};

describe('server jobs stats', () => {
    it('prints the totals and a row per job that ran', async () => {
        const calls = installFetch({ [`GET ${BASE}/stats`]: { body: STATS } });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);

        await run('stats', context);

        expect(calls.map((c) => c.url)).toEqual([`${BASE}/stats`]);
        expect(out.lines).toContain('Last 24 hours:');
        expect(out.lines.some((l) => l.includes('Success Rate') && l.endsWith('80%'))).toBeTrue();
        expect(out.lines.some((l) => l.includes('P95 Duration') && l.endsWith('3.0s'))).toBeTrue();
        expect(out.tables[0].headers).toEqual(['Job', 'Runs', 'Succeeded', 'Failed', 'Cancelled', 'Success', 'Avg', 'P95']);
        expect(out.tables[0].rows).toEqual([['Cleanup', '10', '8', '1', '1', '80%', '1.2s', '3.0s']]);
    });

    it('says so when nothing ran', async () => {
        installFetch({
            [`GET ${BASE}/stats`]: { body: { ...STATS, totals: { ...STATS.totals, total: 0 }, jobs: [] } },
        });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        await run('stats', context);
        expect(out.info).toEqual(['No runs in the last 24 hours.']);
        expect(out.tables.length).toBe(0);
    });

    it('reports a server error and goes on with the other servers', async () => {
        installFetch({
            [`GET ${BASE}/stats`]: { status: 500, body: { error: 'boom' } },
            [`GET ${BASE2}/stats`]: { body: STATS },
        });
        const { context, out } = createContext([
            { name: 'one', url: 'http://srv1.test' },
            { name: 'two', url: 'http://srv2.test' },
        ]);
        await run('stats', context);
        expect(out.error).toEqual(['Failed to read statistics on one: boom']);
        expect(out.tables.length).toBe(1);
    });

    it('--server limits it to one server', async () => {
        const calls = installFetch({ [`GET ${BASE2}/stats`]: { body: STATS } });
        const { context } = createContext([
            { name: 'one', url: 'http://srv1.test' },
            { name: 'two', url: 'http://srv2.test' },
        ]);
        await run('stats', context, undefined, { server: 'two' });
        expect(calls.map((c) => c.url)).toEqual([`${BASE2}/stats`]);
    });
});

describe('server jobs history clear', () => {
    afterEach(() => jasmine.getEnv().allowRespy(false));

    it('asks, then deletes the finished runs of the job', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`DELETE ${BASE}/job-1/history`]: { body: { deleted: 7 } },
        });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        const confirm = spyOn(context.reader, 'readConfirm').and.resolveTo(true);

        await run('history', context, 'clear cleanup');

        expect(confirm).toHaveBeenCalledWith('Delete the finished runs of job "Cleanup"?', false);
        expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([`GET ${BASE}`, `DELETE ${BASE}/job-1/history`]);
        expect(out.success).toEqual(['Deleted 7 runs of "Cleanup".']);
    });

    it('deletes nothing when the user declines or cancels', async () => {
        jasmine.getEnv().allowRespy(true);
        for (const answer of [false, null]) {
            const calls = installFetch({ [`GET ${BASE}`]: { body: [JOB] } });
            const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }], { confirm: answer });
            await run('history', context, 'clear cleanup');
            expect(calls.some((c) => c.method === 'DELETE')).toBeFalse();
            expect(out.info).toEqual(['Cancelled. Nothing was deleted.']);
        }
    });

    it('--yes (or -y) skips the question; --status deletes only those runs', async () => {
        jasmine.getEnv().allowRespy(true);
        for (const yes of [{ yes: true }, { y: true }]) {
            const calls = installFetch({
                [`GET ${BASE}`]: { body: [JOB] },
                [`DELETE ${BASE}/job-1/history?status=failed`]: { body: { deleted: 1 } },
            });
            const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
            const confirm = spyOn(context.reader, 'readConfirm');
            await run('history', context, 'clear cleanup', { ...yes, status: 'failed' });
            expect(confirm).not.toHaveBeenCalled();
            expect(calls[1].url).toBe(`${BASE}/job-1/history?status=failed`);
            expect(out.success).toEqual(['Deleted 1 run of "Cleanup".']);
        }
    });

    it('says when there was nothing to delete', async () => {
        installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`DELETE ${BASE}/job-1/history`]: { body: { deleted: 0 } },
        });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        await run('history', context, 'clear cleanup', { yes: true });
        expect(out.success).toEqual(['No finished runs of "Cleanup" to delete.']);
    });

    it('reports a server error', async () => {
        installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`DELETE ${BASE}/job-1/history`]: { status: 403, body: { error: 'missing permission jobs:manage' } },
        });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        await run('history', context, 'clear cleanup', { yes: true });
        expect(out.error).toEqual(['Failed to clear history on one: missing permission jobs:manage']);
    });

    it('rejects an unknown status and reports a missing job', async () => {
        const calls = installFetch({ [`GET ${BASE}`]: { body: [JOB] } });
        const bad = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        await run('history', bad.context, 'clear cleanup', { status: 'nope' });
        expect(bad.out.error[0]).toContain('Unknown status "nope"');
        expect(calls.length).toBe(0);

        const missing = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        await run('history', missing.context, 'clear ghost', { yes: true });
        expect(missing.out.error).toEqual(['Job "ghost" not found on server one.']);
        expect(calls.some((c) => c.method === 'DELETE')).toBeFalse();
    });

    it('a lone "clear" is still the history of a job called clear', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [{ ...JOB, id: 'job-c', name: 'clear' }] },
            [`GET ${BASE}/job-c/history?limit=20&offset=0`]: { body: { items: [], total: 0, limit: 20, offset: 0 } },
        });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        await run('history', context, 'clear', { limit: 20, offset: 0 });
        expect(calls.some((c) => c.method === 'DELETE')).toBeFalse();
        expect(out.info).toEqual(['No execution history for "clear".']);
    });
});

describe('server jobs history rm', () => {
    const HISTORY = { items: [RUN_A, { ...RUN_A, id: 'aaaa1111-ffff-0000-0000-000000000009' }, { ...RUN_A, id: 'cccc3333-0000-0000-0000-000000000003' }], total: 3, limit: 100, offset: 0 };

    it('resolves the short ID, asks, then deletes the run', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`GET ${BASE}/job-1/history?limit=100`]: { body: HISTORY },
            [`DELETE ${BASE}/job-1/history/cccc3333-0000-0000-0000-000000000003`]: { body: { message: 'Run deleted' } },
        });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        const confirm = spyOn(context.reader, 'readConfirm').and.resolveTo(true);

        await run('history', context, 'rm cleanup cccc3333');

        expect(confirm).toHaveBeenCalledWith('Delete run cccc3333-0000-0000-0000-000000000003 of job "Cleanup"?', false);
        expect(calls.map((c) => c.method)).toEqual(['GET', 'GET', 'DELETE']);
        expect(out.success).toEqual(['Deleted run cccc3333-0000-0000-0000-000000000003 of "Cleanup".']);
    });

    it('takes a quoted job name with spaces and --yes', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [{ ...JOB, name: 'Nightly Cleanup' }] },
            [`GET ${BASE}/job-1/history?limit=100`]: { body: HISTORY },
            [`DELETE ${BASE}/job-1/history/cccc3333-0000-0000-0000-000000000003`]: { body: { message: 'Run deleted' } },
        });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        const confirm = spyOn(context.reader, 'readConfirm');
        await run('history', context, 'rm "Nightly Cleanup" cccc3333', { yes: true });
        expect(confirm).not.toHaveBeenCalled();
        expect(calls.length).toBe(3);
        expect(out.success.length).toBe(1);
    });

    it('deletes nothing when the user declines', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`GET ${BASE}/job-1/history?limit=100`]: { body: HISTORY },
        });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }], { confirm: false });
        await run('history', context, 'rm cleanup cccc3333');
        expect(calls.some((c) => c.method === 'DELETE')).toBeFalse();
        expect(out.info).toEqual(['Cancelled. Nothing was deleted.']);
    });

    it('refuses an ambiguous short ID', async () => {
        const calls = installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`GET ${BASE}/job-1/history?limit=100`]: { body: HISTORY },
        });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        await run('history', context, 'rm cleanup aaaa1111', { yes: true });
        expect(out.error).toEqual(['Run ID "aaaa1111" matches several runs of "Cleanup"; give more characters.']);
        expect(calls.some((c) => c.method === 'DELETE')).toBeFalse();
    });

    it('reports the server error for an unknown run', async () => {
        installFetch({
            [`GET ${BASE}`]: { body: [JOB] },
            [`GET ${BASE}/job-1/history?limit=100`]: { body: HISTORY },
            [`DELETE ${BASE}/job-1/history/zzzz`]: { status: 404, body: { error: 'Execution not found' } },
        });
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        await run('history', context, 'rm cleanup zzzz', { yes: true });
        expect(out.error).toEqual(['Failed to delete the run on one: Execution not found']);
    });

    it('needs a job and a run ID', async () => {
        const calls = installFetch({});
        const { context, out } = createContext([{ name: 'one', url: 'http://srv1.test' }]);
        await run('history', context, 'rm cleanup');
        expect(out.error).toEqual(['Usage: server jobs history rm <name|id> <run-id>']);
        expect(calls.length).toBe(0);
    });
});

describe('server jobs helpers', () => {
    it('parseRunsLimit', () => {
        expect(parseRunsLimit(undefined)).toBe(20);
        expect(parseRunsLimit('')).toBe(20);
        expect(parseRunsLimit(1)).toBe(1);
        expect(parseRunsLimit('100')).toBe(100);
        expect(parseRunsLimit(0)).toBeNull();
        expect(parseRunsLimit(101)).toBeNull();
        expect(parseRunsLimit('x')).toBeNull();
        expect(parseRunsLimit(true)).toBeNull();
    });

    it('formatRate', () => {
        expect(formatRate(null)).toBe('-');
        expect(formatRate(1)).toBe('100%');
        expect(formatRate(0.975)).toBe('97.5%');
    });

    it('resolveRunId keeps a full ID and passes an unknown one through', async () => {
        const service = jasmine.createSpyObj<CliJobsService>('service', ['getHistory']);
        service.getHistory.and.resolveTo({ items: [RUN_A], total: 1, limit: 100, offset: 0 });
        expect(await resolveRunId(service, 'job-1', RUN_A.id)).toBe(RUN_A.id);
        expect(await resolveRunId(service, 'job-1', 'AAAA1111')).toBe(RUN_A.id);
        expect(await resolveRunId(service, 'job-1', 'other')).toBe('other');
    });

    it('the service encodes run IDs and statuses', async () => {
        const calls = installFetch({});
        const service = new CliJobsService('http://srv1.test');
        await expectAsync(service.deleteRun('a b', 'c/d')).toBeRejected();
        await expectAsync(service.clearHistory('a b', 'timed_out')).toBeRejected();
        await expectAsync(service.listRuns({ jobIds: ['x', 'y'], offset: 5 })).toBeRejected();
        expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
            `DELETE ${BASE}/a%20b/history/c%2Fd`,
            `DELETE ${BASE}/a%20b/history?status=timed_out`,
            `GET ${BASE}/executions?job=x&job=y&offset=5`,
        ]);
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

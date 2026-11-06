import { ICliAuthorizationService_TOKEN } from '@qodalis/cli-core';
import {
    CliEventsCommandProcessor,
    formatServerEventFields,
} from '../lib/processors/system/cli-events-command-processor';
import { CliEventBus } from '../lib/services/cli-event-bus';

function setup(permissions: string[] | undefined) {
    const bus = new CliEventBus();
    const out: string[] = [];
    const errors: string[] = [];
    let exitCode: number | undefined;
    const auth = permissions && {
        getPrincipal: () => ({ name: 'guest' }),
        can: (p: string) => permissions.includes(p),
        canAccess: () => true,
    };
    const context: any = {
        events: bus,
        services: { get: (t: any) => (t === ICliAuthorizationService_TOKEN ? auth : undefined) },
        writer: {
            writeln: (t = '') => out.push(t),
            writeInfo: (t: string) => out.push(t),
            writeSuccess: (t: string) => out.push(t),
            writeError: (t: string) => errors.push(t),
            wrapInColor: (t: string) => t,
        },
        process: { exit: (code: number) => (exitCode = code) },
        onAbort: {
            subscribe: (fn: () => void) => {
                abortHandlers.push(fn);
                return { unsubscribe: () => undefined };
            },
        },
    };
    const abortHandlers: Array<() => void> = [];
    const abort = () => abortHandlers.forEach((fn) => fn());
    const serverEvent = (server: string, data: Record<string, unknown>) =>
        bus.emit('server:event', { server, type: data['type'] as string, data }, { source: `server-events:${server}` });
    const sub = (name: string) => new CliEventsCommandProcessor().processors!.find((p) => p.command === name)!;
    const run = (name: string, value: string, positionals: string[], args: Record<string, unknown> = {}) =>
        sub(name).processCommand(
            { command: name, value, positionals, args, chainCommands: [], rawCommand: '' } as any,
            context,
        );
    return { bus, out, errors, run, abort, serverEvent, exit: () => exitCode };
}

describe('events command access', () => {
    it('hides user:* events from those who may not read the audit log', async () => {
        const { bus, out, run } = setup([]);
        bus.emit('user:login', { user: { name: 'admin' } });
        bus.emit('demo:ping', { n: 1 });
        await run('log', '', []);
        const text = out.join('\n');
        expect(text).toContain('demo:ping');
        expect(text).not.toContain('user:login');
    });

    it('shows them with audit:read, or without an auth module', async () => {
        for (const perms of [['audit:read'], undefined]) {
            const { bus, out, run } = setup(perms);
            bus.emit('user:login', { user: { name: 'admin' } });
            await run('log', '', []);
            expect(out.join('\n')).toContain('user:login');
        }
    });

    it('refuses to emit system events', async () => {
        const { bus, errors, run, exit } = setup(undefined);
        let switched = false;
        bus.on('session:changed', () => (switched = true));
        await run('emit', 'session:changed {"user":"admin"}', ['session:changed', '{user:admin}']);
        expect(switched).toBeFalse();
        expect(errors[0]).toContain('system event');
        expect(exit()).toBe(1);
        await run('emit', 'demo:ping', ['demo:ping']);
        expect(bus.history('demo:ping').length).toBe(1);
    });
});

describe('events command with server events', () => {
    it('matches server events by their own type, shown with the server name and the time sent', async () => {
        const { bus, out, run, abort, serverEvent } = setup(undefined);
        const done = run('watch', 'job:*', ['job:*']);
        serverEvent('node', { type: 'job:completed', timestamp: '2026-11-06T10:15:00.000Z', jobId: 'cleanup', duration: 1520 });
        serverEvent('dotnet', { type: 'user:created', userId: 'u1' });
        bus.emit('job:local', { n: 1 });
        abort();
        await done;
        serverEvent('node', { type: 'job:started', jobId: 'late' });

        const lines = out.slice(1);
        expect(lines.length).toBe(2);
        expect(lines[0]).toBe('10:15:00.000  job:completed  [node]  jobId=cleanup duration=1520');
        expect(lines[1]).toContain('job:local');
    });

    it('filters by server (any case) or to the terminal only', async () => {
        const { bus, out, run, serverEvent } = setup(undefined);
        serverEvent('node', { type: 'fs:changed', action: 'upload', path: '/a.txt' });
        serverEvent('dotnet', { type: 'fs:changed', action: 'delete', path: '/b.txt' });
        bus.emit('demo:ping', { n: 1 });

        await run('log', '', [], { server: 'NODE' });
        expect(out.join('\n')).toContain('fs:changed  [node]  action=upload path=/a.txt');
        expect(out.join('\n')).not.toContain('dotnet');
        expect(out.join('\n')).not.toContain('demo:ping');

        out.length = 0;
        await run('log', '', [], { local: true });
        expect(out.join('\n')).toContain('demo:ping');
        expect(out.join('\n')).not.toContain('fs:changed');
    });

    it('still lists every server event under server:*', async () => {
        const { out, run, serverEvent } = setup(undefined);
        serverEvent('node', { type: 'user:deleted', userId: 'u1' });
        await run('log', 'server:*', ['server:*']);
        expect(out.join('\n')).toContain('user:deleted  [node]  userId=u1');
    });

    it('does not hide server user:* events, which the server already scoped', async () => {
        const { out, run, serverEvent } = setup([]);
        serverEvent('node', { type: 'user:created', userId: 'u1' });
        await run('log', '', []);
        expect(out.join('\n')).toContain('user:created');
    });
});

describe('formatServerEventFields', () => {
    it('skips the envelope and empty values, quotes text with spaces and shortens long lines', () => {
        expect(formatServerEventFields({ type: 'x', timestamp: 't', a: 1, b: null, c: { d: 2 }, e: 'two words' }))
            .toBe('a=1 c={"d":2} e="two words"');
        expect(formatServerEventFields({ long: 'x'.repeat(300) }).length).toBe(120);
        expect(formatServerEventFields(undefined)).toBe('');
    });
});

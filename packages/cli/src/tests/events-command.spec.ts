import { ICliAuthorizationService_TOKEN } from '@qodalis/cli-core';
import { CliEventsCommandProcessor } from '../lib/processors/system/cli-events-command-processor';
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
    };
    const sub = (name: string) => new CliEventsCommandProcessor().processors!.find((p) => p.command === name)!;
    const run = (name: string, value: string, positionals: string[]) =>
        sub(name).processCommand(
            { command: name, value, positionals, args: {}, chainCommands: [], rawCommand: '' } as any,
            context,
        );
    return { bus, out, errors, run, exit: () => exitCode };
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

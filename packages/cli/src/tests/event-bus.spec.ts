import { CliEvent } from '@qodalis/cli-core';
import {
    CliEventBus,
    matchesEventPattern,
} from '../lib/services/cli-event-bus';
import { CliEngine } from '../lib/engine/cli-engine';

describe('CliEventBus', () => {
    let bus: CliEventBus;
    let errors: unknown[];

    beforeEach(() => {
        errors = [];
        bus = new CliEventBus((e) => errors.push(e), 5);
    });

    it('matches exact types, namespaces and *', () => {
        expect(
            matchesEventPattern('package:installed', 'package:installed'),
        ).toBeTrue();
        expect(
            matchesEventPattern('package:installed', 'package:*'),
        ).toBeTrue();
        expect(matchesEventPattern('package:a:b', 'package:*')).toBeTrue();
        expect(matchesEventPattern('packages:x', 'package:*')).toBeFalse();
        expect(matchesEventPattern('anything', '*')).toBeTrue();
        expect(
            matchesEventPattern('package:removed', 'package:installed'),
        ).toBeFalse();
    });

    it('delivers to matching handlers with type, data, source and timestamp', () => {
        const seen: CliEvent[] = [];
        bus.on('demo:*', (e) => seen.push(e));
        bus.on('other:*', () => fail('must not receive'));

        bus.emit('demo:ping', { n: 1 }, { source: 'test' });

        expect(seen.length).toBe(1);
        expect(seen[0].type).toBe('demo:ping');
        expect(seen[0].data).toEqual({ n: 1 });
        expect(seen[0].source).toBe('test');
        expect(typeof seen[0].timestamp).toBe('number');
    });

    it('unsubscribes', () => {
        let count = 0;
        const off = bus.on('*', () => count++);
        bus.emit('a:b', 1);
        off();
        bus.emit('a:b', 2);
        expect(count).toBe(1);
    });

    it('once fires a single time', () => {
        let count = 0;
        bus.once('a:*', () => count++);
        bus.emit('a:1', 1);
        bus.emit('a:2', 2);
        expect(count).toBe(1);
    });

    it('a failing handler does not stop the others or the emitter', () => {
        const seen: number[] = [];
        bus.on('x:*', () => {
            throw new Error('boom');
        });
        bus.on('x:*', (e) => seen.push(e.data as number));

        expect(() => bus.emit('x:y', 7)).not.toThrow();
        expect(seen).toEqual([7]);
        expect(errors.length).toBe(1);
    });

    it('keeps a bounded in-memory history, filterable and limitable', () => {
        for (let i = 1; i <= 7; i++) bus.emit(i % 2 ? 'odd:n' : 'even:n', i);
        const all = bus.history();
        expect(all.map((e) => e.data)).toEqual([3, 4, 5, 6, 7]); // size 5
        expect(bus.history('odd:*').map((e) => e.data)).toEqual([3, 5, 7]);
        expect(bus.history('*', 2).map((e) => e.data)).toEqual([6, 7]);
    });

    it('exposes matching events as an observable', () => {
        const seen: unknown[] = [];
        const sub = bus.events$('a:*').subscribe((e) => seen.push(e.data));
        bus.emit('a:1', 1);
        bus.emit('b:1', 2);
        sub.unsubscribe();
        bus.emit('a:2', 3);
        expect(seen).toEqual([1]);
    });

    it('stops delivering and completes observables when disposed', () => {
        let completed = false;
        bus.events$().subscribe({ complete: () => (completed = true) });
        bus.dispose();
        expect(completed).toBeTrue();
        expect(() => bus.emit('a:b', 1)).not.toThrow();
        expect(bus.history()).toEqual([]);
    });
});

describe('CliEngine system events', () => {
    let container: HTMLElement;
    let engine: CliEngine | undefined;

    beforeEach(() => {
        localStorage.clear();
        container = document.createElement('div');
        container.style.width = '800px';
        container.style.height = '400px';
        document.body.appendChild(container);
    });

    afterEach(() => {
        engine?.destroy();
        engine = undefined;
        container.remove();
    });

    it('emits boot, module, command, config and session events', async () => {
        const types: string[] = [];
        let commandEvent: any;
        engine = new CliEngine(container);
        engine.registerModule({
            apiVersion: 2,
            name: 'listener',
            onInit: async (ctx) => {
                ctx.events!.on('*', (e) => {
                    types.push(e.type);
                    if (e.type === 'command:executed') commandEvent = e.data;
                });
            },
        });
        await engine.start();

        expect(types).toContain('module:loaded');
        expect(types).toContain('boot:completed');

        await engine.execute('echo hi');
        expect(commandEvent.command).toBe('echo hi');
        expect(commandEvent.exitCode).toBe(0);

        await engine.execute('configure set system.greeting false');
        expect(types).toContain('config:changed');

        engine.getContext().userSession = { user: { name: 'alice' } } as any;
        expect(types).toContain('session:changed');
        expect(
            engine.getContext().events!.history('session:changed').pop()!.data,
        ).toEqual({
            user: 'alice',
        });
    });

    it('lists and emits events with the events command', async () => {
        engine = new CliEngine(container);
        await engine.start();
        const bus = engine.getContext().events!;
        let received: unknown;
        bus.on('demo:ping', (e) => (received = e.data));

        await engine.execute('events emit demo:ping {"n": 1}');
        expect(received).toEqual({ n: 1 });

        await engine.execute('events log demo:*');
        await new Promise<void>((r) => engine!.getTerminal().write('', r));
        const buffer = engine.getTerminal().buffer.active;
        let text = '';
        for (let i = 0; i < buffer.length; i++)
            text += buffer.getLine(i)?.translateToString(true) + '\n';
        expect(text).toMatch(/demo:ping\s+\[events\]\s+\{"n":1\}/);
    });
});

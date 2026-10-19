import { CliEventBus } from '../lib/services/cli-event-bus';

interface TodoAdded {
    id: number;
    text: string;
}

/**
 * Compile-time checks for the typed and anonymous overloads: this file only
 * builds when typed events are checked and custom events stay open.
 */
describe('CliEventBus typing', () => {
    it('supports typed, explicitly typed and anonymous use', () => {
        const bus = new CliEventBus();
        const seen: unknown[] = [];

        // Typed by name: payload from CliEventMap
        bus.on('package:installed', (e) => seen.push(e.data.version));
        // Explicit payload type for a custom event
        bus.on<TodoAdded>('todo:added', (e) => seen.push(e.data.text));
        // Anonymous: any pattern, data is unknown
        bus.on('todo:*', (e) => seen.push(e.type));
        bus.once('boot:completed', (e) => seen.push(e.data.durationMs));

        bus.emit('package:installed', { name: 'a', version: '1.0.0' });
        bus.emit<TodoAdded>('todo:added', { id: 1, text: 'buy milk' });
        bus.emit('todo:refresh');

        // @ts-expect-error a known event needs its full payload
        bus.emit('package:installed', { name: 'a' });
        // @ts-expect-error a known event cannot go through the untyped overload
        bus.emit('package:installed', 123);
        // @ts-expect-error typed handlers only see the declared fields
        bus.on('package:installed', (e) => seen.push(e.data.nope));

        expect(bus.history<TodoAdded>('todo:added')[0].data.text).toBe(
            'buy milk',
        );
        expect(seen).toContain('1.0.0');
        expect(seen).toContain('buy milk');
        expect(seen).toContain('todo:refresh');
    });
});

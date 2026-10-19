import { Subject } from 'rxjs';
import { ICliUserEvent } from '@qodalis/cli-core';
import { publishUserEvents } from '../lib/events';

describe('publishUserEvents', () => {
    it('forwards user events to the bus as user:<type>', () => {
        const events$ = new Subject<ICliUserEvent>();
        const emitted: Array<{ type: string; data: unknown; source?: string }> =
            [];
        const bus = {
            emit: (
                type: string,
                data: unknown,
                options?: { source?: string },
            ) => emitted.push({ type, data, source: options?.source }),
        } as any;

        const sub = publishUserEvents(events$, bus)!;
        const event: ICliUserEvent = {
            type: 'login',
            user: { name: 'alice' } as any,
            timestamp: 1,
        };
        events$.next(event);
        sub.unsubscribe();
        events$.next({ ...event, type: 'logout' });

        expect(emitted).toEqual([
            { type: 'user:login', data: event, source: '@qodalis/cli-users' },
        ]);
    });

    it('does nothing without a bus', () => {
        expect(
            publishUserEvents(new Subject<ICliUserEvent>(), undefined),
        ).toBeUndefined();
    });
});

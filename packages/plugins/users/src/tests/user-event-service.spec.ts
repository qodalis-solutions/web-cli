import { CliDefaultUserEventService } from '../lib/services/cli-default-user-event.service';
import { ICliUserEvent, ICliUser } from '@qodalis/cli-core';
import { firstValueFrom, take, toArray } from 'rxjs';

function makeUser(overrides: Partial<ICliUser> = {}): ICliUser {
    return {
        id: 'user-1',
        name: 'alice',
        email: 'alice@test.com',
        groups: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...overrides,
    };
}

describe('CliDefaultUserEventService', () => {
    let service: CliDefaultUserEventService;

    beforeEach(() => {
        service = new CliDefaultUserEventService();
    });

    it('should emit events to subscribers', (done) => {
        const user = makeUser();

        service.events$.pipe(take(1)).subscribe((event) => {
            expect(event.type).toBe('login');
            expect(event.user.name).toBe('alice');
            expect(event.timestamp).toBeGreaterThan(0);
            done();
        });

        service.emit({
            type: 'login',
            user,
            timestamp: Date.now(),
        });
    });

    it('should emit multiple events in order', (done) => {
        const user = makeUser();

        service.events$.pipe(take(3), toArray()).subscribe((events) => {
            expect(events.length).toBe(3);
            expect(events[0].type).toBe('login');
            expect(events[1].type).toBe('password_changed');
            expect(events[2].type).toBe('logout');
            done();
        });

        service.emit({ type: 'login', user, timestamp: Date.now() });
        service.emit({ type: 'password_changed', user, timestamp: Date.now() });
        service.emit({ type: 'logout', user, timestamp: Date.now() });
    });

    it('should include details when provided', (done) => {
        const user = makeUser();

        service.events$.pipe(take(1)).subscribe((event) => {
            expect(event.details).toBe('Session expired');
            done();
        });

        service.emit({
            type: 'logout',
            user,
            timestamp: Date.now(),
            details: 'Session expired',
        });
    });

    it('should not emit to subscribers that unsubscribed', () => {
        const user = makeUser();
        const received: ICliUserEvent[] = [];

        const sub = service.events$.subscribe((event) => {
            received.push(event);
        });

        service.emit({ type: 'login', user, timestamp: Date.now() });
        expect(received.length).toBe(1);

        sub.unsubscribe();

        service.emit({ type: 'logout', user, timestamp: Date.now() });
        expect(received.length).toBe(1); // Still 1
    });

    it('should support multiple concurrent subscribers', () => {
        const user = makeUser();
        let count1 = 0;
        let count2 = 0;

        service.events$.subscribe(() => count1++);
        service.events$.subscribe(() => count2++);

        service.emit({ type: 'login', user, timestamp: Date.now() });

        expect(count1).toBe(1);
        expect(count2).toBe(1);
    });
});

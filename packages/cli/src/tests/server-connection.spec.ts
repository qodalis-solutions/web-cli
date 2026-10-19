import { CliServerConnection } from '../lib/server/cli-server-connection';
import { CliBackgroundServiceRegistry } from '../lib/services/background/cli-background-service-registry';

/** Minimal WebSocket stand-in */
class FakeSocket {
    static all: FakeSocket[] = [];
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readyState = FakeSocket.OPEN;
    onopen: any = null;
    onmessage: any = null;
    onclose: any = null;
    onerror: any = null;
    constructor(readonly url: string) {
        FakeSocket.all.push(this);
    }
    send() {}
    close() {
        this.readyState = FakeSocket.CLOSED;
    }
}

describe('CliServerConnection event socket', () => {
    const RealWebSocket = (globalThis as any).WebSocket;
    beforeEach(() => {
        FakeSocket.all = [];
        (globalThis as any).WebSocket = FakeSocket;
        spyOn(globalThis, 'fetch').and.callFake(async (input: any) => {
            const url = String(input);
            if (url.endsWith('/commands')) {
                return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
            return new Response('', { status: 404 });
        });
    });
    afterEach(() => ((globalThis as any).WebSocket = RealWebSocket));

    async function flush() {
        for (let i = 0; i < 10; i++) await Promise.resolve();
    }

    const open = () => FakeSocket.all.filter((s) => s.readyState === FakeSocket.OPEN);

    it('reconnecting an already connected server does not leave the old socket open', async () => {
        const connection = new CliServerConnection({ name: 'node', url: 'http://srv' });
        await connection.connect();
        await flush();
        expect(open().length).toBe(1);

        await connection.connect();
        await flush();
        expect(FakeSocket.all.length).toBe(2);
        expect(open().length).toBe(1);
        expect(FakeSocket.all[0].onclose).toBeNull();
        connection.disconnect();
        expect(open().length).toBe(0);
    });

    it('a 4401 close (session ended) does not schedule reconnect attempts', async () => {
        jasmine.clock().install();
        try {
            const connection = new CliServerConnection({ name: 'node', url: 'http://srv' });
            await connection.connect();
            await flush();
            expect(FakeSocket.all.length).toBe(1);
            FakeSocket.all[0].readyState = FakeSocket.CLOSED;
            FakeSocket.all[0].onclose({ code: 4401, reason: 'session ended' });
            jasmine.clock().tick(120_000);
            await flush();
            expect(FakeSocket.all.length).toBe(1);
            expect(connection.connected).toBeTrue();
            connection.disconnect();
        } finally {
            jasmine.clock().uninstall();
        }
    });

    it('an unreachable server costs one request, not a second one for its commands', async () => {
        const spy = (globalThis.fetch as jasmine.Spy).and.callFake(async () => {
            throw new TypeError('Failed to fetch');
        });
        const connection = new CliServerConnection({ name: 'node', url: 'http://srv' });
        await connection.connect();
        expect(connection.connected).toBeFalse();
        expect(spy.calls.count()).toBe(1);
    });

    it('a closed socket from a server that stopped marks it disconnected at once', async () => {
        const connection = new CliServerConnection({ name: 'node', url: 'http://srv' });
        let disconnected = 0;
        connection.onDisconnect = () => disconnected++;
        await connection.connect();
        await flush();
        expect(connection.connected).toBeTrue();
        (globalThis.fetch as jasmine.Spy).and.callFake(async () => {
            throw new TypeError('Failed to fetch');
        });
        FakeSocket.all[0].readyState = FakeSocket.CLOSED;
        FakeSocket.all[0].onclose({ code: 1006 });
        await flush();
        expect(connection.connected).toBeFalse();
        expect(disconnected).toBe(1);
        connection.disconnect();
    });

    it('a dropped socket on a server that still answers keeps the connection', async () => {
        const connection = new CliServerConnection({ name: 'node', url: 'http://srv' });
        await connection.connect();
        await flush();
        (globalThis.fetch as jasmine.Spy).and.callFake(async () => new Response('{}', { status: 200 }));
        FakeSocket.all[0].readyState = FakeSocket.CLOSED;
        FakeSocket.all[0].onclose({ code: 1006 });
        await flush();
        expect(connection.connected).toBeTrue();
        connection.disconnect();
    });

    describe('with background services', () => {
        function setup() {
            const registry = new CliBackgroundServiceRegistry({} as any, {} as any);
            const events: any[] = [];
            registry.on((e) => events.push(e), { source: 'server-events:node', type: 'session-kicked' });
            const connection = new CliServerConnection({ name: 'node', url: 'http://srv' }, registry);
            return { registry, events, connection };
        }

        it('a reconnect reuses the event service instead of falling back to a direct socket', async () => {
            const { registry, events, connection } = setup();
            await connection.connect();
            await flush();
            await connection.connect(); // e.g. the users module reconnects after a sign-in
            await flush();
            expect(open().length).toBe(1);
            expect(registry.list().filter((s) => s.name === 'server-events:node').length).toBe(1);
            expect(registry.getStatus('server-events:node')!.status).toBe('running');
            const latest = FakeSocket.all[FakeSocket.all.length - 1];
            latest.onmessage({ data: JSON.stringify({ type: 'session-kicked', data: { sessionId: 'S1' } }) });
            expect(events.map((e) => e.type)).toEqual(['session-kicked']);
            connection.disconnect();
            await flush();
            expect(open().length).toBe(0);
        });

        it('a dropped socket reconnects through the same event service', async () => {
            jasmine.clock().install();
            try {
                const { events, connection } = setup();
                await connection.connect();
                await flush();
                FakeSocket.all[0].readyState = FakeSocket.CLOSED;
                FakeSocket.all[0].onclose();
                jasmine.clock().tick(1000);
                await flush();
                expect(FakeSocket.all.length).toBe(2);
                FakeSocket.all[1].onmessage({ data: JSON.stringify({ type: 'session-kicked' }) });
                expect(events.map((e) => e.type)).toEqual(['session-kicked']);
                connection.disconnect();
            } finally {
                jasmine.clock().uninstall();
            }
        });
    });

    it('does not open a socket when disconnected while the ticket was being fetched', async () => {
        let release!: (v: Record<string, string>) => void;
        const authService: any = {
            getHeaders: () => ({}),
            getWebSocketParams: () => new Promise((r) => (release = r)),
        };
        const connection = new CliServerConnection({ name: 'node', url: 'http://srv' }, undefined, undefined, authService);
        await connection.connect();
        await flush();
        connection.disconnect();
        release({ ticket: 'T' });
        await flush();
        expect(open().length).toBe(0);
    });
});

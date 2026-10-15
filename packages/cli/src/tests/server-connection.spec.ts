import { CliServerConnection } from '../lib/server/cli-server-connection';

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

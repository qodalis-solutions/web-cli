import { CliServerConnection } from '../lib/server/cli-server-connection';
import { CliServerManager } from '../lib/server/cli-server-manager';
import { CliCommandProcessorRegistry } from '../lib/registry/cli-command-processor-registry';
import { CliBackgroundServiceRegistry } from '../lib/services/background/cli-background-service-registry';

/** A WebSocket that never opens nor closes: drops are seen only by polling */
class SilentSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readyState = SilentSocket.CONNECTING;
    onopen: any = null;
    onmessage: any = null;
    onclose: any = null;
    onerror: any = null;
    constructor(readonly url: string) {}
    send() {}
    close() {
        this.readyState = SilentSocket.CLOSED;
    }
}

describe('Server health monitor (server-health:<name>)', () => {
    const RealWebSocket = (globalThis as any).WebSocket;
    /** What the fake server does: 'up', 'down' (network error) or 'sign-in' (401 on commands) */
    let server: 'up' | 'down' | 'sign-in';
    let fetchSpy: jasmine.Spy;
    let visibility: DocumentVisibilityState;

    const probes = () =>
        fetchSpy.calls.all().filter((c) => String(c.args[0]).endsWith('/api/qcli/versions')).length;

    beforeEach(() => {
        server = 'up';
        visibility = 'visible';
        (globalThis as any).WebSocket = SilentSocket;
        spyOnProperty(document, 'visibilityState', 'get').and.callFake(() => visibility);
        // Plain objects, not Response: reading a real body takes browser tasks the fake clock cannot flush
        const reply = (status: number, body: unknown = null) =>
            ({ ok: status >= 200 && status < 300, status, statusText: '', json: async () => body }) as Response;
        fetchSpy = spyOn(globalThis, 'fetch').and.callFake(async (input: any) => {
            if (server === 'down') throw new TypeError('Failed to fetch');
            const url = String(input);
            if (url.endsWith('/commands')) {
                if (server === 'sign-in') return reply(401);
                return reply(200, [{ command: 'status', description: 'Status' }]);
            }
            if (url.endsWith('/execute')) return reply(200, { exitCode: 0, outputs: [] });
            return reply(404);
        });
        jasmine.clock().install();
    });

    afterEach(() => {
        jasmine.clock().uninstall();
        (globalThis as any).WebSocket = RealWebSocket;
    });

    async function flush() {
        for (let i = 0; i < 30; i++) await Promise.resolve();
    }

    async function tick(ms: number) {
        jasmine.clock().tick(ms);
        await flush();
    }

    function setup(config: Record<string, unknown> = {}) {
        const services = new CliBackgroundServiceRegistry({} as any, {} as any);
        const connection = new CliServerConnection(
            { name: 'node', url: 'http://srv', ...config } as any,
            services,
        );
        const disconnects = jasmine.createSpy('onDisconnect');
        const reconnects = jasmine.createSpy('onReconnected');
        connection.onDisconnect = disconnects;
        connection.onReconnected = reconnects;
        return { services, connection, disconnects, reconnects };
    }

    it('marks a server disconnected within one polling interval, without the event socket', async () => {
        const { services, connection, disconnects } = setup();
        await connection.connect();
        connection.startHealthCheck();
        await flush();
        expect(services.getStatus('server-health:node')?.status).toBe('running');

        await tick(30000);
        expect(connection.connected).toBeTrue();

        server = 'down';
        await tick(30000);
        expect(connection.connected).toBeFalse();
        expect(disconnects).toHaveBeenCalledTimes(1);

        const log = services.getLogs('server-health:node').map((e) => e.message);
        expect(log).toContain('Check: up');
        expect(log).toContain('Check: no answer, marking the server disconnected');
        connection.disconnect();
    });

    it('keeps retrying with a capped backoff and reconnects after more than 5 failed checks', async () => {
        const { services, connection, reconnects } = setup();
        await connection.connect();
        connection.startHealthCheck();
        server = 'down';
        await tick(30000);
        expect(connection.connected).toBeFalse();

        // 5 s, 10 s, 20 s, 40 s, then 60 s each: well past the old 5 attempts
        const before = probes();
        for (const delay of [5000, 10000, 20000, 40000, 60000, 60000, 60000]) {
            await tick(delay);
        }
        expect(probes() - before).toBe(7);
        expect(connection.connected).toBeFalse();

        // The backoff stays at the cap
        await tick(59000);
        expect(probes() - before).toBe(7);

        server = 'up';
        await tick(1000);
        expect(connection.connected).toBeTrue();
        expect(reconnects).toHaveBeenCalledTimes(1);
        expect(services.getLogs('server-health:node').map((e) => e.message)).toContain('Connected');

        // Polls at the connected interval again
        const connectedAt = probes();
        await tick(30000);
        expect(probes() - connectedAt).toBe(1);
        connection.disconnect();
    });

    it('connects a server that was down at startup once it answers, and registers its commands', async () => {
        server = 'down';
        const registry = new CliCommandProcessorRegistry();
        const services = new CliBackgroundServiceRegistry({} as any, {} as any);
        const events = { emit: jasmine.createSpy('emit') };
        const manager = new CliServerManager(registry, undefined, events as any);
        await manager.connectAll([{ name: 'node', url: 'http://srv' }], undefined, services);
        const connection = manager.getConnection('node')!;
        expect(connection.connected).toBeFalse();
        expect(events.emit).toHaveBeenCalledWith('server:unavailable', jasmine.anything());
        expect(services.list().map((s) => s.name)).toContain('server-health:node');
        expect(registry.findProcessor('node:status', [])).toBeUndefined();

        await tick(5000);
        expect(connection.connected).toBeFalse();

        server = 'up';
        await tick(10000);
        expect(connection.connected).toBeTrue();
        expect(registry.findProcessor('node:status', [])).toBeDefined();
        expect(registry.findProcessor('status', [])).toBeDefined();
        expect(events.emit).toHaveBeenCalledWith('server:connected', jasmine.objectContaining({ name: 'node', reconnected: true }));
        manager.removeServer('node');
    });

    it('leaves a server that needs a sign-in to the auth layer', async () => {
        server = 'sign-in';
        const { connection, reconnects } = setup();
        await connection.connect();
        expect(connection.needsSignIn).toBeTrue();
        connection.startHealthCheck();
        await flush();

        const before = fetchSpy.calls.count();
        await tick(10 * 60000);
        expect(fetchSpy.calls.count()).toBe(before);
        expect(connection.connected).toBeFalse();
        expect(reconnects).not.toHaveBeenCalled();

        // A sign-in connects it: polling starts at the connected interval
        server = 'up';
        await connection.connect();
        const connectedAt = probes();
        await tick(30000);
        expect(probes() - connectedAt).toBe(1);
        connection.disconnect();
    });

    it('does not poll while the tab is hidden and checks once it becomes visible', async () => {
        const { connection, disconnects } = setup();
        await connection.connect();
        connection.startHealthCheck();
        await flush();

        visibility = 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));
        server = 'down';
        const before = fetchSpy.calls.count();
        await tick(5 * 60000);
        expect(fetchSpy.calls.count()).toBe(before);
        expect(connection.connected).toBeTrue();

        visibility = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));
        await flush();
        expect(connection.connected).toBeFalse();
        expect(disconnects).toHaveBeenCalledTimes(1);
        connection.disconnect();
    });

    it('checks at once when the browser comes back online', async () => {
        const { connection, reconnects } = setup();
        server = 'down';
        await connection.connect();
        connection.startHealthCheck();
        await flush();

        server = 'up';
        window.dispatchEvent(new Event('online'));
        await flush();
        expect(connection.connected).toBeTrue();
        expect(reconnects).toHaveBeenCalledTimes(1);
        connection.disconnect();
    });

    it('a command failing with a network error checks the server at once', async () => {
        const { connection, disconnects } = setup();
        await connection.connect();
        connection.startHealthCheck();
        await flush();

        server = 'down';
        const run = connection.execute({ command: 'status' } as any).catch((e) => e);
        await flush();
        await tick(1000); // the one retry of execute
        expect(await run).toEqual(jasmine.any(TypeError));
        expect(connection.connected).toBeFalse();
        expect(disconnects).toHaveBeenCalledTimes(1);
        connection.disconnect();
    });

    it('healthCheck: false turns polling off', async () => {
        const { connection } = setup({ healthCheck: false });
        await connection.connect();
        connection.startHealthCheck();
        await flush();
        server = 'down';
        const before = fetchSpy.calls.count();
        await tick(10 * 60000);
        expect(fetchSpy.calls.count()).toBe(before);
        expect(connection.connected).toBeTrue();
        connection.disconnect();
    });

    it('uses the configured interval and backoff', async () => {
        const { connection } = setup({ healthCheck: { interval: 1000, retryDelay: 100, maxRetryDelay: 200 } });
        await connection.connect();
        connection.startHealthCheck();
        await flush();
        server = 'down';
        await tick(1000);
        expect(connection.connected).toBeFalse();
        const before = probes();
        await tick(100);
        await tick(200);
        await tick(200);
        expect(probes() - before).toBe(3);
        connection.disconnect();
    });

    it('stopping the service stops polling; disconnect stops it too', async () => {
        const { services, connection } = setup();
        await connection.connect();
        connection.startHealthCheck();
        await flush();
        await services.stop('server-health:node');
        expect(connection.healthCheckRunning).toBeFalse();
        const before = fetchSpy.calls.count();
        await tick(5 * 60000);
        expect(fetchSpy.calls.count()).toBe(before);

        await services.start('server-health:node');
        expect(connection.healthCheckRunning).toBeTrue();
        connection.disconnect();
        await flush();
        expect(services.getStatus('server-health:node')?.status).toBe('stopped');
    });
});

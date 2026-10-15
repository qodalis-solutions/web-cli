import { CliServerManager_TOKEN } from '../lib/server/cli-server-manager';
import { CliSshCommandProcessor, describeShellClose } from '../lib/server/cli-ssh-command-processor';
import { CliExecutionProcess } from '../lib/context/cli-execution-process';

/** Minimal WebSocket stand-in driven by the test */
class FakeSocket {
    static last: FakeSocket;
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    readyState = FakeSocket.OPEN;
    onopen: any = null;
    onmessage: any = null;
    onclose: any = null;
    onerror: any = null;
    sent: string[] = [];
    constructor(readonly url: string) {
        FakeSocket.last = this;
    }
    send(data: string) {
        this.sent.push(data);
    }
    close() {
        this.readyState = 3;
    }
    push(msg: object) {
        this.onmessage?.({ data: JSON.stringify(msg) });
    }
}

describe('ssh (shell over WebSocket)', () => {
    const RealWebSocket = (globalThis as any).WebSocket;
    beforeEach(() => ((globalThis as any).WebSocket = FakeSocket));
    afterEach(() => ((globalThis as any).WebSocket = RealWebSocket));

    function setup() {
        const written: string[] = [];
        const connection = {
            connected: true,
            capabilities: { shell: true },
            buildWebSocketUrl: async (path: string) => `ws://srv${path}&ticket=T`,
        };
        const context: any = {
            services: { getRequired: (t: string) => (t === CliServerManager_TOKEN ? { connections: new Map([['node', connection]]) } : undefined) },
            terminal: { cols: 80, rows: 24, write: (d: string) => written.push(d) },
            writer: {
                writeInfo: (m: string) => written.push(m),
                writeError: (m: string) => written.push(m),
                writeWarning: (m: string) => written.push(m),
                writeln: (m: string) => written.push(m),
            },
            spinner: { show() {}, hide() {} },
            enterFullScreenMode: jasmine.createSpy('enterFullScreenMode'),
            exitFullScreenMode: jasmine.createSpy('exitFullScreenMode'),
        };
        context.process = new CliExecutionProcess(context);
        context.process.start();
        return { context, written };
    }

    async function flush() {
        for (let i = 0; i < 5; i++) await Promise.resolve();
    }

    it('interactive: completes cleanly when the shell exits', async () => {
        const { context, written } = setup();
        const run = new CliSshCommandProcessor().processCommand({ command: 'ssh', value: 'node' } as any, context);
        await flush();
        const socket = FakeSocket.last;
        expect(socket.url).toContain('/ws/v1/qcli/shell?cols=80&rows=24');
        socket.push({ type: 'ready', os: 'linux', shell: 'sh' });
        expect(context.enterFullScreenMode).toHaveBeenCalled();
        socket.push({ type: 'stdout', data: 'hi' });
        // must not throw out of the socket callback
        expect(() => socket.push({ type: 'exit', code: 0 })).not.toThrow();
        await run;
        expect(context.exitFullScreenMode).toHaveBeenCalled();
        expect(written).toContain('Shell exited with code 0.');
        expect(socket.onmessage).toBeNull(); // cleaned up
        expect(context.process.exitCode).toBe(0);
    });

    it('interactive: a non-zero exit or server error ends the command with that code', async () => {
        const { context } = setup();
        const run = new CliSshCommandProcessor().processCommand({ command: 'ssh', value: 'node' } as any, context);
        await flush();
        FakeSocket.last.push({ type: 'ready', os: 'linux', shell: 'sh' });
        expect(() => FakeSocket.last.push({ type: 'exit', code: 3 })).not.toThrow();
        await run;
        expect(context.process.exitCode).toBe(3);

        const second = setup();
        const run2 = new CliSshCommandProcessor().processCommand({ command: 'ssh', value: 'node' } as any, second.context);
        await flush();
        expect(() => FakeSocket.last.push({ type: 'error', message: 'shell disabled' })).not.toThrow();
        await run2;
        expect(second.context.process.exitCode).toBe(1);
        expect(second.written).toContain('Server error: shell disabled');
    });

    it('interactive: an unexpected close ends the command', async () => {
        const { context, written } = setup();
        const run = new CliSshCommandProcessor().processCommand({ command: 'ssh', value: 'node' } as any, context);
        await flush();
        FakeSocket.last.push({ type: 'ready', os: 'linux', shell: 'sh' });
        expect(() => FakeSocket.last.onclose()).not.toThrow();
        await run;
        expect(context.process.exitCode).toBe(1);
        expect(written).toContain("Connection to 'node' closed.");
    });

    it('one-shot: runs a command and resolves on exit', async () => {
        const { context, written } = setup();
        const run = new CliSshCommandProcessor().processCommand({ command: 'ssh', value: 'node echo hi' } as any, context);
        await flush();
        expect(FakeSocket.last.url).toContain('&cmd=echo%20hi');
        FakeSocket.last.push({ type: 'stdout', data: 'hi' });
        expect(() => FakeSocket.last.push({ type: 'exit', code: 2 })).not.toThrow();
        await run;
        expect(written).toContain('hi');
        expect(context.process.exitCode).toBe(2);
    });

    it('one-shot: passes the remote command verbatim, including flag-like tokens', async () => {
        const { context } = setup();
        // the executor strips "-c" from value; rawCommand keeps it
        const run = new CliSshCommandProcessor().processCommand(
            { command: 'ssh', value: "node sh 'exit 4'", rawCommand: "ssh node sh -c 'exit 4'", args: { c: true } } as any,
            context,
        );
        await flush();
        expect(decodeURIComponent(FakeSocket.last.url)).toContain("&cmd=sh -c 'exit 4'");
        FakeSocket.last.push({ type: 'exit', code: 4 });
        await run;
        expect(context.process.exitCode).toBe(4);
    });

    it('requires shell:execute (enforced only when an auth module is loaded)', () => {
        expect(new CliSshCommandProcessor().metadata.requiredPermissions).toEqual(['shell:execute']);
    });

    it('reports why the server closed the shell', async () => {
        const { context, written } = setup();
        const run = new CliSshCommandProcessor().processCommand({ command: 'ssh', value: 'node' } as any, context);
        await flush();
        FakeSocket.last.onerror?.({});
        FakeSocket.last.onclose({ code: 4403, reason: 'forbidden' });
        await run;
        expect(written).toContain("ssh: permission denied on 'node' (requires shell:execute or a valid shell token)");
        expect(written.some((w) => w.includes('WebSocket error'))).toBeFalse();
        expect(context.process.exitCode).toBe(1);
        expect(context.exitFullScreenMode).not.toHaveBeenCalled(); // never entered
    });

    it('a session ending mid-shell leaves full-screen with a clear message', async () => {
        const { context, written } = setup();
        const run = new CliSshCommandProcessor().processCommand({ command: 'ssh', value: 'node' } as any, context);
        await flush();
        FakeSocket.last.push({ type: 'ready', os: 'linux', shell: 'sh' });
        FakeSocket.last.onclose({ code: 4401, reason: 'session ended' });
        await run;
        expect(context.exitFullScreenMode).toHaveBeenCalled();
        expect(written).toContain("ssh: your session on 'node' ended. Please log in again.");
    });

    it('one-shot: a plain connection failure still reports a WebSocket error', async () => {
        const { context, written } = setup();
        const run = new CliSshCommandProcessor().processCommand({ command: 'ssh', value: 'node ls', rawCommand: 'ssh node ls' } as any, context);
        await flush();
        FakeSocket.last.onerror?.({});
        FakeSocket.last.onclose({ code: 1006 });
        await run;
        expect(written).toContain("WebSocket error connecting to 'node'.");
        expect(context.process.exitCode).toBe(1);
    });

    it('maps every documented close code', () => {
        expect(describeShellClose({ code: 4401, reason: 'login required' }, 's')).toBe("ssh: login required on 's'");
        expect(describeShellClose({ code: 4401, reason: 'shell access is not configured' }, 's')).toContain('not configured');
        expect(describeShellClose({ code: 4404 }, 's')).toContain('disabled');
        expect(describeShellClose({ code: 4408 }, 's')).toContain('timed out');
        expect(describeShellClose({ code: 4429 }, 's')).toContain('too many');
        expect(describeShellClose({ code: 1000 }, 's')).toBeNull();
    });
});

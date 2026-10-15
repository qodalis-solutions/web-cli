import { CliCommandProcessorRegistry } from '../lib/registry/cli-command-processor-registry';
import { CliServerManager } from '../lib/server/cli-server-manager';

describe('CliServerManager.preferredServer', () => {
    function manager(state: Record<string, boolean>) {
        const m = new CliServerManager({} as any);
        for (const [name, connected] of Object.entries(state)) {
            m.connections.set(name, { connected } as any);
        }
        return m;
    }

    it('is the first connected server when no default is set', () => {
        expect(manager({ dotnet: false, node: true, python: true }).preferredServer()).toBe('node');
    });

    it('prefers the default server while it is connected', () => {
        const m = manager({ node: true, python: true });
        (m as any)._defaultServer = 'python';
        expect(m.preferredServer()).toBe('python');
        (m.connections.get('python') as any).connected = false;
        expect(m.preferredServer()).toBe('node');
    });

    it('is null when nothing is connected', () => {
        expect(manager({ dotnet: false }).preferredServer()).toBeNull();
    });
});

describe('CliServerManager bare aliases', () => {
    function setup() {
        const registry = new CliCommandProcessorRegistry();
        // A local plugin command that needs a server (like data-explorer)
        const local: any = { command: 'data-explorer', metadata: { requireServer: true }, processCommand: async () => undefined };
        registry.registerProcessor(local);
        const connection: any = {
            connected: true,
            commands: [{ command: 'status', description: 'Server status' }],
            connect: async () => undefined,
            stopHealthCheck: () => undefined,
            startHealthCheck: () => undefined,
        };
        const manager = new CliServerManager(registry);
        manager.connections.set('node', connection);
        return { registry, local, manager, connection };
    }

    const names = (registry: any) => registry.processors.map((p: any) => p.command).sort();

    it('reconnect keeps local processors that declare requireServer', async () => {
        const { registry, manager } = setup();
        await manager.reconnect('node');
        expect(names(registry)).toEqual(['data-explorer', 'node:status', 'status']);
        await manager.reconnect('node');
        expect(names(registry)).toEqual(['data-explorer', 'node:status', 'status']);
    });

    it('a disconnect removes only the server commands', async () => {
        const { registry, manager, connection } = setup();
        await manager.reconnect('node');
        connection.connected = false;
        (manager as any).handleDisconnect('node');
        expect(names(registry)).toEqual(['data-explorer']);
    });

    it('never replaces a local command with a server alias of the same name', async () => {
        const { registry, manager, connection, local } = setup();
        connection.commands.push({ command: 'data-explorer', description: 'remote' });
        await manager.reconnect('node');
        expect(registry.findProcessor('data-explorer', [])).toBe(local);
        expect(names(registry)).toContain('node:data-explorer');
    });
    it('keeps a local processor installed later under the name of a bare alias', async () => {
        const { registry, manager } = setup();
        await manager.reconnect('node');
        // e.g. `pkg add` installs a local `status` command after the server alias
        const localStatus: any = { command: 'status', processCommand: async () => undefined };
        registry.registerProcessor(localStatus);
        await manager.reconnect('node');
        expect(registry.findProcessor('status', [])).toBe(localStatus);
        expect(names(registry)).toEqual(['data-explorer', 'node:status', 'status']);
    });
});

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

    it('a server command that shares a local command name stays reachable by its namespaced name', async () => {
        const { registry, manager, connection } = setup();
        const localEcho: any = { command: 'echo', aliases: ['print'], processCommand: async () => undefined };
        registry.registerProcessor(localEcho);
        connection.commands.push({ command: 'echo', description: 'remote echo' });
        await manager.reconnect('node');
        expect(registry.findProcessor('echo', [])).toBe(localEcho);
        expect(registry.findProcessor('node:echo', [])).toBeDefined();
        expect(registry.findProcessor('node:echo', [])).not.toBe(localEcho);
    });

    it('server commands accept a value (node:hello world, bare and multi-server aliases)', async () => {
        const { registry, manager, connection } = setup();
        connection.commands.push(
            { command: 'hello', description: 'Greets' },
            { command: 'weather', description: 'Weather', processors: [{ command: 'current', description: 'Now' }] },
        );
        await manager.reconnect('node');
        expect(registry.findProcessor('node:hello', ['world'])?.command).toBe('node:hello');
        expect(registry.findProcessor('hello', ['world'])?.command).toBe('hello');
        expect(registry.findProcessor('node:weather', ['current', 'london'])?.command).toBe('current');

        const python: any = { ...connection, commands: [{ command: 'hello', description: 'Greets' }] };
        manager.connections.set('python', python);
        await manager.reconnect('python');
        expect(registry.findProcessor('hello', ['world'])).toBeDefined();
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

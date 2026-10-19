import { CliTestHarness } from '../lib/testing/cli-test-harness';
import { CliServerCommandProcessor } from '../lib/server/cli-server-command-processor';
import { CliSshCommandProcessor } from '../lib/server/cli-ssh-command-processor';
import { CliServerManager, CliServerManager_TOKEN } from '../lib/server/cli-server-manager';
import { closest } from '../lib/server/cli-server-command-helpers';
import { CliCommandProcessorRegistry } from '../lib/registry/cli-command-processor-registry';
import { CliServerNameCompletionProvider } from '../lib/completion/cli-server-name-completion-provider';

function fakeConnection(
    name: string,
    options: { connected: boolean; reachable?: boolean; shell?: boolean; commands?: string[] },
): any {
    return {
        connected: options.connected,
        config: { name, url: `http://localhost/${name}` },
        apiVersion: 1,
        capabilities: options.connected
            ? { shell: !!options.shell, version: '2.0.0', os: 'linux', streaming: true }
            : null,
        commands: (options.commands ?? []).map((command) => ({
            command,
            description: `${command} on ${name}`,
        })),
        ping: async () => options.reachable ?? options.connected,
        connect: async () => undefined,
        stopHealthCheck: () => undefined,
        startHealthCheck: () => undefined,
    };
}

describe('server command', () => {
    let harness: CliTestHarness;
    let manager: CliServerManager;

    beforeEach(() => {
        harness = new CliTestHarness();
        manager = new CliServerManager(new CliCommandProcessorRegistry());
        manager.connections.set(
            'node',
            fakeConnection('node', { connected: true, commands: ['echo', 'status'] }),
        );
        manager.connections.set('dotnet', fakeConnection('dotnet', { connected: false }));
        harness.registerService(CliServerManager_TOKEN, manager);
        harness.registerProcessor(new CliServerCommandProcessor());
        harness.registerProcessor(new CliSshCommandProcessor());
    });

    it('shows the servers when run alone, and through its aliases', async () => {
        for (const line of ['server', 'servers', 'srv', 'server ls', 'server list']) {
            const result = await harness.execute(line);
            const table = result.tables[0];
            expect(table).withContext(line).toBeDefined();
            expect(table.headers).toEqual([
                'Name', 'Status', 'URL', 'Version', 'API', 'Commands', 'Shell',
            ]);
            expect(table.rows.map((r) => r[0])).toEqual(['node', 'dotnet']);
            expect(table.rows[0][3]).toBe('2.0.0');
            expect(table.rows[1][5]).toBe('-');
        }
    });

    it('marks the default server in the list', async () => {
        manager.setDefaultServer('node');
        const result = await harness.execute('server ls');
        expect(result.tables[0].rows[0][0]).toBe('node *');
    });

    it('pings every server without a name', async () => {
        const result = await harness.execute('server ping');
        expect(result.output).toMatch(/node\s+\d+ ms\s+2 commands/);
        expect(result.output).toMatch(/dotnet\s+unreachable/);
    });

    it('shows one server in detail, case-insensitively', async () => {
        const result = await harness.execute('server info NODE');
        expect(result.output).toContain('node');
        expect(result.output).toContain('2.0.0');
        expect(result.output).toContain('server commands node');
        expect(result.exitCode ?? 0).toBe(0);
    });

    it('explains what to check for an unreachable server', async () => {
        const result = await harness.execute('server status dotnet');
        const all = result.output + result.stderr.join('\n');
        expect(all).toContain('No answer from http://localhost/dotnet');
        expect(all).toContain('CORS');
        expect(all).toContain('server reconnect dotnet');
    });

    it('suggests the closest name for a typo and exits 1', async () => {
        const result = await harness.execute('server status nod');
        expect(result.stderr.join('\n')).toContain(
            "Unknown server 'nod'. Did you mean 'node'?",
        );
        expect(result.output).toContain('Configured servers');
        expect(result.exitCode).toBe(1);
        expect(result.stderr.join('\n')).not.toContain('Process exited');
    });

    it('lists the commands of a server', async () => {
        const result = await harness.execute('server cmds node');
        expect(result.output).toContain('2 commands');
        expect(result.output).toContain('echo on node');
        const all = await harness.execute('server commands');
        expect(all.output).toContain('dotnet');
        expect(all.output).toContain('unreachable');
    });

    it('reconnects the unreachable servers by default', async () => {
        const reconnect = spyOn(manager, 'reconnect').and.resolveTo({
            success: true,
            commandCount: 3,
        });
        const result = await harness.execute('server rc');
        expect(reconnect.calls.allArgs()).toEqual([['dotnet']]);
        expect(result.stderr.join('\n') + result.output).toContain(
            'Connected to dotnet: 3 commands',
        );

        reconnect.calls.reset();
        await harness.execute('server reconnect --all');
        expect(reconnect.calls.allArgs()).toEqual([['node'], ['dotnet']]);

        reconnect.calls.reset();
        await harness.execute('server connect Node');
        expect(reconnect.calls.allArgs()).toEqual([['node']]);
    });

    it('reports a failed reconnect with exit code 1', async () => {
        spyOn(manager, 'reconnect').and.resolveTo({ success: false, commandCount: 0 });
        const result = await harness.execute('server reconnect dotnet');
        expect(result.stderr.join('\n')).toContain('Could not connect to dotnet');
        expect(result.exitCode).toBe(1);
    });

    it('sets, shows, saves and clears the default server', async () => {
        const result = await harness.execute('server use Node');
        expect(result.output).toContain('Default server set to node');
        expect(manager.defaultServer).toBe('node');
        const shown = await harness.execute('server default');
        expect(shown.output).toContain('Default server: node');

        // Saved: the next terminal restores it at boot
        const restored = new CliServerManager(new CliCommandProcessorRegistry());
        restored.connections.set('node', manager.connections.get('node')!);
        let saved: any = {};
        await new CliServerCommandProcessor().initialize({
            services: { get: () => restored },
            state: { getState: () => (saved = { defaultServer: 'node' }) },
        } as any);
        expect(saved.defaultServer).toBe('node');
        expect(restored.defaultServer).toBe('node');

        await harness.execute('server default --clear');
        expect(manager.defaultServer).toBeNull();
    });

    it('explains why ssh cannot connect', async () => {
        const unknown = await harness.execute('ssh nde');
        expect(unknown.stderr.join('\n')).toContain("Did you mean 'node'?");

        const down = await harness.execute('ssh dotnet');
        expect(down.stderr.join('\n')).toContain('dotnet is unreachable');

        const noShell = await harness.execute('shell node');
        expect(noShell.stderr.join('\n')).toContain(
            'node does not allow shell access',
        );

        const none = await harness.execute('ssh');
        expect(none.stderr.join('\n')).toContain(
            'none of the connected servers (node) allow shell access',
        );
        expect(none.exitCode).toBe(1);
    });

    it('says how to configure servers when there are none', async () => {
        manager.connections.clear();
        const result = await harness.execute('server');
        expect(result.output + result.stderr.join('\n')).toContain(
            'No servers configured',
        );
        expect(result.output).toContain('servers: [');
    });
});

describe('closest', () => {
    it('suggests names within about one typo per three letters', () => {
        expect(closest('nod', ['node', 'dotnet', 'python'])).toBe('node');
        expect(closest('pyhton', ['node', 'dotnet', 'python'])).toBe('python');
        expect(closest('dot', ['node', 'dotnet', 'python'])).toBe('dotnet');
        expect(closest('xyz', ['node', 'dotnet', 'python'])).toBeUndefined();
    });
});

describe('server name completion', () => {
    const manager = new CliServerManager(new CliCommandProcessorRegistry());
    manager.connections.set('node', fakeConnection('node', { connected: true, shell: true }));
    manager.connections.set('dotnet', fakeConnection('dotnet', { connected: true }));
    const provider = new CliServerNameCompletionProvider(manager);
    const complete = (line: string) => {
        const tokens = line.split(' ');
        return provider.getCompletions({
            tokens,
            tokenIndex: tokens.length - 1,
            token: tokens[tokens.length - 1],
        } as any);
    };

    it('completes names after the sub-commands and their aliases', () => {
        for (const line of ['server status n', 'srv ping n', 'servers use n', 'server cmds n', 'server rc n']) {
            expect(complete(line)).withContext(line).toEqual(['node']);
        }
        expect(complete('server ls n')).toEqual([]);
    });

    it('completes shell servers after ssh and shell', () => {
        expect(complete('ssh ')).toEqual(['node']);
        expect(complete('shell n')).toEqual(['node']);
    });
});

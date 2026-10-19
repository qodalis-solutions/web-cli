import {
    CliForegroundColor,
    CliIcon,
    CliProcessCommand,
    CliStateConfiguration,
    ICliCommandChildProcessor,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { CliProcessorsRegistry_TOKEN } from '../tokens';
import {
    writeExamples,
    writeHint,
    writeUsage,
    writeWrapped,
} from '../processors/system/packages/package-help';
import { CliServerConnection } from './cli-server-connection';
import { CliServerManager, CliServerManager_TOKEN } from './cli-server-manager';
import {
    defaultMarker,
    pingServer,
    resolveServer,
    serverManagerOf,
    statusLabel,
    writeConfigureHint,
} from './cli-server-command-helpers';

/** Saved across reloads (the default server). */
interface ServerState {
    defaultServer?: string | null;
}

/**
 * `server`: the servers this terminal is connected to (configured by the
 * app in `options.servers`). Their commands are available directly (`echo`)
 * and namespaced (`node:echo`).
 */
export class CliServerCommandProcessor implements ICliCommandProcessor {
    command = 'server';
    aliases = ['servers', 'srv'];
    description = 'Manage remote CLI server connections';
    metadata = {
        icon: CliIcon.Server,
        module: '@qodalis/cli-server',
        sealed: true,
    };
    stateConfiguration: CliStateConfiguration = {
        storeName: 'server',
        initialState: { defaultServer: null } as ServerState,
        autoPersist: true,
    };
    processors: ICliCommandChildProcessor[] = [
        new ServerListProcessor(),
        new ServerStatusProcessor(),
        new ServerCommandsProcessor(),
        new ServerReconnectProcessor(),
        new ServerDefaultProcessor(),
    ];

    /** Restore the default server saved by `server default <name>`. */
    async initialize(context: ICliExecutionContext): Promise<void> {
        const saved = context.state.getState<ServerState>().defaultServer;
        const manager = context.services.get(CliServerManager_TOKEN);
        if (saved && manager?.connections.has(saved)) {
            manager.setDefaultServer(saved);
        }
    }

    /** `server` alone: the servers, then what can be done with them. */
    async processCommand(
        _command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const manager = serverManagerOf(context);
        if (!manager) return;
        writeServerTable(context, manager);
        context.writer.writeln();
        writeHint(context, 'help server', 'to see everything you can do');
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writeWrapped(
            context,
            'Connect the terminal to remote CLI servers (.NET, Node.js, Python) and run their commands.',
        );
        writer.writeln();
        writeWrapped(
            context,
            `Each server's commands are available by name (${writer.wrapInColor('echo hi', CliForegroundColor.Cyan)}) and with the server as prefix (${writer.wrapInColor('node:echo hi', CliForegroundColor.Cyan)}). When several servers have the same command, the default server runs it; without one you are asked which server to use. A local command with the same name wins: use the prefixed name. A server that goes down is retried every 30 seconds, and its commands come back when it does.`,
        );
        writer.writeln();
        writeUsage(context, [
            ['server', 'Overview of the servers'],
            ['server list|ls', 'Servers with status, version and commands'],
            ['server status|ping [name]', 'Check servers are reachable (all, or one in detail)'],
            ['server commands|cmds [name]', 'Commands each server provides'],
            ['server reconnect|rc [name]', 'Connect again (unreachable servers, or one)'],
            ['server default|use [name]', 'Show or set the server for shared commands'],
            ['ssh [name] [command]', 'Open a shell on a server, or run one command'],
        ]);
        writer.writeln();
        writeExamples(context, [
            ['server status node', 'Ping node and show its details'],
            ['server commands node', 'What node can do'],
            ['node:echo hello', 'Run echo on node explicitly'],
            ['server use node', 'Shared commands run on node'],
            ['server rc', 'Retry every unreachable server'],
        ]);
        writer.writeln();
        writer.writeln(`🔗 Aliases: ${writer.wrapInColor('servers', CliForegroundColor.Magenta)}, ${writer.wrapInColor('srv', CliForegroundColor.Magenta)}`);
    }
}

// ── list ────────────────────────────────────────────────────────────

class ServerListProcessor implements ICliCommandChildProcessor {
    command = 'list';
    aliases = ['ls'];
    description = 'Show the servers with their status, version and commands';
    parent?: ICliCommandProcessor;

    async processCommand(
        _command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const manager = serverManagerOf(context);
        if (manager) writeServerTable(context, manager);
    }

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'List the configured servers: connection status, URL, server and API version, number of commands and shell access.',
        );
        context.writer.writeln();
        writeUsage(context, [['server list', ''], ['server ls', '']]);
    }
}

function writeServerTable(
    context: ICliExecutionContext,
    manager: CliServerManager,
): void {
    const { writer } = context;
    if (manager.connections.size === 0) {
        writer.writeInfo('No servers configured.');
        writeConfigureHint(context);
        return;
    }

    const rows: string[][] = [];
    let unreachable = 0;
    for (const [name, connection] of manager.connections) {
        const connected = connection.connected;
        if (!connected) unreachable++;
        rows.push([
            name + (manager.defaultServer === name ? ' *' : ''),
            statusLabel(context, connection),
            connection.config.url,
            connected ? (connection.capabilities?.version ?? '-') : '-',
            connected ? `v${connection.apiVersion}` : '-',
            connected ? String(connection.commands.length) : '-',
            connected ? (connection.capabilities?.shell ? 'yes' : 'no') : '-',
        ]);
    }

    writer.writeln(`🖥  Servers (${manager.connections.size}):`);
    writer.writeTable(
        ['Name', 'Status', 'URL', 'Version', 'API', 'Commands', 'Shell'],
        rows,
    );
    if (manager.defaultServer) {
        writer.writeln(`  * default server`);
    }
    if (unreachable > 0) {
        writer.writeln();
        writeHint(
            context,
            'server status <name>',
            'to see why a server is unreachable, server reconnect to retry',
        );
    }
}

// ── status ──────────────────────────────────────────────────────────

class ServerStatusProcessor implements ICliCommandChildProcessor {
    command = 'status';
    aliases = ['ping', 'info'];
    description = 'Check that servers are reachable (all, or one in detail)';
    acceptsRawInput = true;
    parent?: ICliCommandProcessor;

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const manager = serverManagerOf(context);
        if (!manager) return;
        const name = command.value?.trim();

        if (!name) {
            await this.statusOfAll(context, manager);
            return;
        }

        const server = resolveServer(context, manager, name);
        if (!server) return;
        await this.statusOfOne(context, manager, server.name, server.connection);
    }

    private async statusOfAll(
        context: ICliExecutionContext,
        manager: CliServerManager,
    ): Promise<void> {
        const { writer } = context;
        if (manager.connections.size === 0) {
            writer.writeInfo('No servers configured.');
            writeConfigureHint(context);
            return;
        }

        context.spinner?.show(`Pinging ${manager.connections.size} server(s)...`);
        const entries = [...manager.connections.entries()];
        const results = await Promise.all(
            entries.map(([, connection]) => pingServer(connection)),
        );
        context.spinner?.hide();

        const width = Math.max(...entries.map(([name]) => name.length));
        entries.forEach(([name, connection], i) => {
            const { reachable, ms } = results[i];
            const label = name.padEnd(width);
            if (reachable) {
                const detail = connection.connected
                    ? `${connection.commands.length} commands`
                    : writer.wrapInColor('reachable, not connected: run server reconnect ' + name, CliForegroundColor.Yellow);
                writer.writeln(
                    `  ${writer.wrapInColor('●', CliForegroundColor.Green)} ${writer.wrapInColor(label, CliForegroundColor.Cyan)}  ${String(ms).padStart(4)} ms  ${detail}${defaultMarker(context, manager, name)}`,
                );
            } else {
                // The URL only when it fits on the line
                const url = connection.config.url;
                const fits =
                    width + url.length + 22 <= (context.terminal?.cols ?? 80);
                writer.writeln(
                    `  ${writer.wrapInColor('○', CliForegroundColor.Red)} ${writer.wrapInColor(label, CliForegroundColor.Cyan)}  ${writer.wrapInColor('unreachable', CliForegroundColor.Red)}${fits ? `  ${url}` : ''}`,
                );
            }
        });

        if (results.some((r) => !r.reachable)) {
            writer.writeln();
            writeHint(context, 'server status <name>', 'for details on a server');
        }
    }

    private async statusOfOne(
        context: ICliExecutionContext,
        manager: CliServerManager,
        name: string,
        connection: CliServerConnection,
    ): Promise<void> {
        const { writer } = context;
        context.spinner?.show(`Pinging ${name}...`);
        const { reachable, ms } = await pingServer(connection);
        context.spinner?.hide();

        const caps = connection.capabilities;
        const yesNo = (value?: boolean) =>
            value === undefined ? '-' : value ? 'yes' : 'no';

        writer.writeln(
            `🖥  ${writer.wrapInColor(name, CliForegroundColor.Cyan)}${defaultMarker(context, manager, name)}`,
        );
        writer.writeKeyValue({
            URL: connection.config.url,
            Status: reachable
                ? connection.connected
                    ? writer.wrapInColor('● connected', CliForegroundColor.Green)
                    : writer.wrapInColor('● reachable, not connected', CliForegroundColor.Yellow)
                : writer.wrapInColor('○ unreachable', CliForegroundColor.Red),
            ...(reachable ? { Latency: `${ms} ms` } : {}),
            ...(connection.connected
                ? {
                      'Server version': caps?.version ?? '-',
                      'API version': `v${connection.apiVersion}`,
                      Commands: String(connection.commands.length),
                      OS: caps?.os ?? '-',
                      Shell: yesNo(caps?.shell),
                      Streaming: yesNo(caps?.streaming),
                  }
                : {}),
        });

        writer.writeln();
        if (!reachable) {
            writer.writeError(`No answer from ${connection.config.url}.`);
            writer.writeln('  Check that:');
            for (const check of [
                '• the server is running and the URL is right',
                `• it allows this page's origin (CORS: ${globalThis.location?.origin ?? 'this origin'})`,
                '• nothing (VPN, proxy, firewall) blocks the connection',
            ]) {
                writeWrapped(context, check, 2);
            }
            writer.writeln();
            writeHint(context, `server reconnect ${name}`, 'to try again');
        } else if (!connection.connected) {
            writeHint(context, `server reconnect ${name}`, 'to load its commands');
        } else {
            writeHint(context, `server commands ${name}`, 'to see its commands');
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'Ping the servers. Without a name, every server is checked at once with its round-trip time; with a name, that server is shown in detail (versions, OS, shell, streaming) with hints when it cannot be reached.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['server status', 'Check every server'],
            ['server status <name>', 'Details of one server'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['server ping', 'Same as server status'],
            ['server info node', 'Details of node'],
        ]);
    }
}

// ── commands ────────────────────────────────────────────────────────

class ServerCommandsProcessor implements ICliCommandChildProcessor {
    command = 'commands';
    aliases = ['cmds'];
    description = 'Show the commands each server provides';
    acceptsRawInput = true;
    parent?: ICliCommandProcessor;

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const manager = serverManagerOf(context);
        if (!manager) return;
        const name = command.value?.trim();

        let servers: [string, CliServerConnection][];
        if (name) {
            const server = resolveServer(context, manager, name);
            if (!server) return;
            servers = [[server.name, server.connection]];
        } else {
            servers = [...manager.connections.entries()];
        }

        if (servers.length === 0) {
            context.writer.writeInfo('No servers configured.');
            writeConfigureHint(context);
            return;
        }

        const registry = context.services.get<ICliCommandProcessorRegistry>(
            CliProcessorsRegistry_TOKEN,
        );
        let shared = false;
        let local = false;
        servers.forEach(([serverName, connection], index) => {
            if (index > 0) context.writer.writeln();
            const result = this.writeServerCommands(
                context,
                manager,
                registry,
                serverName,
                connection,
            );
            shared ||= result.shared;
            local ||= result.local;
        });

        const { writer } = context;
        if (shared || local) writer.writeln();
        if (shared) {
            writeWrapped(
                context,
                `${writer.wrapInColor('◆', CliForegroundColor.Yellow)} on several servers: runs on the default server (server use <name>), or asks`,
                2,
            );
        }
        if (local) {
            writeWrapped(
                context,
                `${writer.wrapInColor('◇', CliForegroundColor.Magenta)} a local command has the same name: run it with the server prefix`,
                2,
            );
        }
    }

    private writeServerCommands(
        context: ICliExecutionContext,
        manager: CliServerManager,
        registry: ICliCommandProcessorRegistry | undefined,
        name: string,
        connection: CliServerConnection,
    ): { shared: boolean; local: boolean } {
        const { writer } = context;
        const title = `🖥  ${writer.wrapInColor(name, CliForegroundColor.Cyan)}${defaultMarker(context, manager, name)}`;
        if (!connection.connected) {
            writer.writeln(
                `${title}  ${writer.wrapInColor('unreachable: its commands are not available', CliForegroundColor.Red)}`,
            );
            return { shared: false, local: false };
        }
        const commands = [...connection.commands].sort((a, b) =>
            a.command.localeCompare(b.command),
        );
        writer.writeln(`${title}  ${commands.length} commands`);
        if (commands.length === 0) return { shared: false, local: false };

        let shared = false;
        let local = false;
        const narrow = (context.terminal?.cols ?? 80) < 60;
        const width =
            Math.max(...commands.map((c) => name.length + 1 + c.command.length)) + 2;
        for (const descriptor of commands) {
            const bare = registry?.findProcessor(descriptor.command, []);
            const module = bare?.metadata?.module;
            // The name to type: bare, unless a local command has it
            let marker = ' ';
            let typed = descriptor.command;
            if (module === 'server:multi') {
                marker = writer.wrapInColor('◆', CliForegroundColor.Yellow);
                shared = true;
            } else if (module !== `server:${name}`) {
                marker = writer.wrapInColor('◇', CliForegroundColor.Magenta);
                typed = `${name}:${descriptor.command}`;
                local = true;
            }
            const subs = descriptor.processors?.length
                ? writer.wrapInColor(
                      `  (${descriptor.processors.map((p) => p.command).join(', ')})`,
                      CliForegroundColor.White,
                  )
                : '';
            if (narrow) {
                // Phones: the description on its own line, wrapped by words
                writer.writeln(
                    `  ${marker} ${writer.wrapInColor(typed, CliForegroundColor.Cyan)}`,
                );
                writeWrapped(context, `${descriptor.description ?? ''}${subs}`, 4);
                continue;
            }
            writer.writeln(
                `  ${marker} ${writer.wrapInColor(typed.padEnd(width), CliForegroundColor.Cyan)}${descriptor.description ?? ''}${subs}`,
            );
        }
        return { shared, local };
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writeWrapped(
            context,
            `List the commands a server provides (all servers, or one). Run them by name, or with the server as prefix: ${writer.wrapInColor('node:echo', CliForegroundColor.Cyan)} always runs on node, also when another server or a local command is called echo.`,
        );
        writer.writeln();
        writeUsage(context, [
            ['server commands', 'Commands of every server'],
            ['server commands <name>', 'Commands of one server'],
        ]);
        writer.writeln();
        writeExamples(context, [['server cmds node', 'What node can do']]);
    }
}

// ── reconnect ───────────────────────────────────────────────────────

class ServerReconnectProcessor implements ICliCommandChildProcessor {
    command = 'reconnect';
    aliases = ['rc', 'connect'];
    description = 'Connect to servers again and reload their commands';
    acceptsRawInput = true;
    parent?: ICliCommandProcessor;
    parameters?: ICliCommandParameterDescriptor[] = [
        {
            name: 'all',
            aliases: ['a'],
            description: 'Reconnect every server, also the connected ones',
            required: false,
            type: 'boolean',
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const manager = serverManagerOf(context);
        if (!manager) return;
        const { writer } = context;
        const name = command.value?.trim();

        let names: string[];
        if (name) {
            const server = resolveServer(context, manager, name);
            if (!server) return;
            names = [server.name];
        } else {
            const all = !!(command.args['all'] || command.args['a']);
            names = [...manager.connections.entries()]
                .filter(([, connection]) => all || !connection.connected)
                .map(([serverName]) => serverName);
            if (manager.connections.size === 0) {
                writer.writeInfo('No servers configured.');
                writeConfigureHint(context);
                return;
            }
            if (names.length === 0) {
                writer.writeSuccess('All servers are connected.');
                writeHint(context, 'server reconnect --all', 'to reconnect them anyway');
                return;
            }
        }

        let failed = 0;
        for (const serverName of names) {
            context.spinner?.show(`Connecting to ${serverName}...`);
            const result = await manager.reconnect(serverName);
            context.spinner?.hide();
            if (result.success) {
                writer.writeSuccess(
                    `Connected to ${serverName}: ${result.commandCount} commands available`,
                );
            } else {
                failed++;
                writer.writeError(
                    `Could not connect to ${serverName} (${manager.getConnection(serverName)?.config.url})`,
                );
            }
        }

        if (failed > 0) {
            writer.writeln();
            writeHint(context, 'server status <name>', 'to see why');
            context.process.exit(1, { silent: true });
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'Connect to servers again and reload their commands, e.g. after a server was restarted or updated. Without a name, every unreachable server is retried.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['server reconnect', 'Retry the unreachable servers'],
            ['server reconnect <name>', 'Reconnect one server'],
            ['server reconnect --all', 'Reconnect every server'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['server rc', 'Same as server reconnect'],
            ['server connect node', 'Reload the commands of node'],
        ]);
    }
}

// ── default ─────────────────────────────────────────────────────────

class ServerDefaultProcessor implements ICliCommandChildProcessor {
    command = 'default';
    aliases = ['use'];
    description = 'Show or set the server that runs commands several servers have';
    acceptsRawInput = true;
    parent?: ICliCommandProcessor;
    parameters?: ICliCommandParameterDescriptor[] = [
        {
            name: 'clear',
            description: 'Remove the default server',
            required: false,
            type: 'boolean',
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const manager = serverManagerOf(context);
        if (!manager) return;
        const { writer } = context;

        if (command.args?.['clear']) {
            manager.setDefaultServer(null);
            context.state.updateState({ defaultServer: null } as ServerState);
            writer.writeSuccess('Default server cleared.');
            writer.writeln(
                '  Commands several servers have will ask which server to use.',
            );
            return;
        }

        const name = command.value?.trim();
        if (!name) {
            this.writeCurrent(context, manager);
            return;
        }

        const server = resolveServer(context, manager, name);
        if (!server) return;
        manager.setDefaultServer(server.name);
        context.state.updateState({ defaultServer: server.name } as ServerState);
        writer.writeSuccess(`Default server set to ${server.name}.`);
        if (!server.connection.connected) {
            writer.writeWarning(
                `${server.name} is unreachable right now: the next connected server is used until it is back.`,
            );
        }
    }

    private writeCurrent(
        context: ICliExecutionContext,
        manager: CliServerManager,
    ): void {
        const { writer } = context;
        const current = manager.defaultServer;
        if (current) {
            const connected = manager.getConnection(current)?.connected;
            writer.writeln(
                `Default server: ${writer.wrapInColor(current, CliForegroundColor.Cyan)}${connected ? '' : writer.wrapInColor(' (unreachable)', CliForegroundColor.Red)}`,
            );
        } else {
            writer.writeln('No default server set.');
        }
        writer.writeln(
            '  It runs commands that several servers have, and commands like server logs that need one server.',
        );
        const preferred = manager.preferredServer();
        if (preferred && preferred !== current) {
            writer.writeln(
                `  Commands that need one server use ${writer.wrapInColor(preferred, CliForegroundColor.Cyan)} now (the first connected).`,
            );
        }
        writer.writeln();
        writeHint(
            context,
            current ? 'server default --clear' : 'server use <name>',
            current ? 'to remove it' : 'to set one',
        );
    }

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'The default server runs commands that several servers have (otherwise you are asked which one) and commands that need one server, like server logs. It is remembered across reloads.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['server default', 'Show the default server'],
            ['server default <name>', 'Set it'],
            ['server default --clear', 'Remove it'],
        ]);
        context.writer.writeln();
        writeExamples(context, [['server use node', 'Same as server default node']]);
    }
}

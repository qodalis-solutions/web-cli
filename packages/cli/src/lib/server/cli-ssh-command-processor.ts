import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    CliServerPermissions,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
    CliKeyData,
    ICliCommandControls,
} from '@qodalis/cli-core';
import { CliServerConnection } from './cli-server-connection';
import { CliServerManager, CliServerManager_TOKEN } from './cli-server-manager';
import { writeConfigureHint, writeUnknownServer } from './cli-server-command-helpers';
import { writeExamples, writeUsage, writeWrapped } from '../processors/system/packages/package-help';

type ShellMessage =
    | { type: 'stdin'; data: string }
    | { type: 'resize'; cols: number; rows: number };

type ServerShellMessage =
    | { type: 'stdout'; data: string }
    | { type: 'stderr'; data: string }
    | { type: 'exit'; code: number }
    | { type: 'error'; message: string }
    | { type: 'ready'; shell: string; os: string };

/**
 * State of one ssh invocation. Kept per call (not on the processor, which is
 * shared): one processor instance can serve several sessions at once, e.g.
 * `engine.execute()` while an interactive shell is open.
 */
interface ShellSession {
    socket: WebSocket | null;
    resolved: boolean;
    /** Full-screen was torn down (exit/dispose): a late close reports nothing */
    disposed: boolean;
}

export class CliSshCommandProcessor implements ICliCommandProcessor {
    command = 'ssh';

    controls: ICliCommandControls = {
        textInput: true,
        keys: [
            { label: 'ESC', key: 'Esc', data: CliKeyData.escape, description: 'Escape' },
            { label: 'TAB', key: 'Tab', data: '\t', description: 'Complete' },
            { label: '^C', key: 'Ctrl+C', data: CliKeyData.ctrl('c'), description: 'Interrupt' },
            { label: '^D', key: 'Ctrl+D', data: CliKeyData.ctrl('d'), description: 'End of input' },
            { label: '^L', key: 'Ctrl+L', data: CliKeyData.ctrl('l'), description: 'Clear the screen' },
            { label: '←', key: 'Left', data: CliKeyData.left, description: 'Left', repeat: true },
            { label: '↑', key: 'Up', data: CliKeyData.up, description: 'Up', repeat: true },
            { label: '↓', key: 'Down', data: CliKeyData.down, description: 'Down', repeat: true },
            { label: '→', key: 'Right', data: CliKeyData.right, description: 'Right', repeat: true },
        ],
    };
    aliases = ['shell'];
    description = 'Open a remote shell session on a server';
    acceptsRawInput = true;
    valueRequired = false;
    metadata: CliProcessorMetadata = {
        module: '@qodalis/cli-server',
        icon: '\u{1F5A5}',
        // Enforced only when an auth module is loaded; the server checks it too
        requiredPermissions: [CliServerPermissions.ShellExecute],
    };
    parameters?: ICliCommandParameterDescriptor[] = [
        {
            name: 'server',
            description: 'Name of the server to connect to',
            required: false,
            type: 'string',
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const manager = context.services.getRequired<CliServerManager>(
            CliServerManager_TOKEN,
        );
        if (!manager) {
            context.writer.writeError('Server manager not available.');
            context.process.exit(1);
            return;
        }

        // Find shell-capable servers
        const shellServers: Array<{
            name: string;
            connection: CliServerConnection;
        }> = [];
        for (const [name, connection] of manager.connections) {
            if (connection.connected && connection.capabilities?.shell) {
                shellServers.push({ name, connection });
            }
        }

        if (shellServers.length === 0) {
            const requested =
                (command.args?.['server'] as string | undefined) ??
                command.value?.trim().split(/\s+/)[0];
            if (requested) {
                this.writeWhyNotAvailable(context, manager, requested);
            } else {
                this.writeNoShellServers(context, manager);
            }
            context.process.exit(1, { silent: true });
            return;
        }

        // Resolve server name from: --server=name, positional arg, or interactive menu
        const { serverName, oneShotCmd, connection } =
            await this.resolveServer(command, shellServers, context);

        if (!serverName || !connection) return;

        if (oneShotCmd) {
            await this.executeOneShot(connection, serverName, oneShotCmd, context);
        } else {
            await this.executeInteractive(connection, serverName, context);
        }
    }

    /**
     * Full-screen handler for one session: input, resize and disposal go to
     * that session's socket only.
     */
    private fullScreenHandler(session: ShellSession): ICliCommandProcessor {
        const handler: ICliCommandProcessor = Object.create(this);
        handler.onData = async (data: string) => {
            if (session.socket?.readyState === WebSocket.OPEN) {
                const msg: ShellMessage = { type: 'stdin', data };
                session.socket.send(JSON.stringify(msg));
            }
        };
        handler.onResize = (cols: number, rows: number) => {
            if (session.socket?.readyState === WebSocket.OPEN) {
                const msg: ShellMessage = { type: 'resize', cols, rows };
                session.socket.send(JSON.stringify(msg));
            }
        };
        handler.onDispose = () => {
            session.disposed = true;
            if (session.socket) {
                if (
                    session.socket.readyState === WebSocket.OPEN ||
                    session.socket.readyState === WebSocket.CONNECTING
                ) {
                    session.socket.close();
                }
                session.socket = null;
            }
        };
        return handler;
    }

    private async resolveServer(
        command: CliProcessCommand,
        shellServers: Array<{ name: string; connection: CliServerConnection }>,
        context: ICliExecutionContext,
    ): Promise<{
        serverName: string | null;
        oneShotCmd: string | null;
        connection: CliServerConnection | null;
    }> {
        const empty = { serverName: null, oneShotCmd: null, connection: null };

        // 1. Check --server=name parameter
        const manager = context.services.getRequired<CliServerManager>(
            CliServerManager_TOKEN,
        );
        const argServer = command.args?.['server'] as string | undefined;
        if (argServer && typeof argServer === 'string') {
            const entry = findServer(shellServers, argServer);
            if (!entry) {
                this.writeWhyNotAvailable(context, manager, argServer);
                context.process.exit(1, { silent: true });
                return empty;
            }
            // One-shot command comes from command.value (text after "ssh" excluding flags)
            // Not applicable with --server=name since value would be empty
            return {
                serverName: entry.name,
                oneShotCmd: null,
                connection: entry.connection,
            };
        }

        // 2. Check positional value: "ssh dotnet" or "ssh dotnet ls -la"
        const value = command.value?.trim();
        if (value) {
            const parts = value.split(/\s+/);
            const candidateName = parts[0];
            const entry = findServer(shellServers, candidateName);
            if (entry) {
                // Take the remote command verbatim from the raw line: the parsed
                // value has flag-like tokens (e.g. `sh -c '...'`) stripped
                const oneShotCmd =
                    this.remoteCommandFromRaw(command.rawCommand, candidateName) ??
                    (parts.slice(1).join(' ') || null);
                return {
                    serverName: entry.name,
                    oneShotCmd,
                    connection: entry.connection,
                };
            }
            // Value doesn't match a shell server: say why
            this.writeWhyNotAvailable(context, manager, candidateName);
            context.process.exit(1, { silent: true });
            return empty;
        }

        // 3. No server specified — auto-select single server
        if (shellServers.length === 1) {
            return {
                serverName: shellServers[0].name,
                oneShotCmd: null,
                connection: shellServers[0].connection,
            };
        }

        // 4. Use default server if set and shell-capable
        if (manager?.defaultServer) {
            const entry = shellServers.find(
                (s) => s.name === manager.defaultServer,
            );
            if (entry) {
                return {
                    serverName: entry.name,
                    oneShotCmd: null,
                    connection: entry.connection,
                };
            }
        }

        // 5. Multiple servers, no default — show interactive menu
        const selected = await context.reader.readSelectInline(
            'Select a server for shell access:',
            shellServers.map((s) => ({
                label: s.name,
                value: s.name,
            })),
        );
        if (!selected) {
            context.writer.writeInfo('Shell cancelled.');
            return empty;
        }
        const entry = shellServers.find((s) => s.name === selected)!;
        return {
            serverName: selected,
            oneShotCmd: null,
            connection: entry.connection,
        };
    }

    /** Why `name` cannot be used: unknown, unreachable or without a shell. */
    private writeWhyNotAvailable(
        context: ICliExecutionContext,
        manager: CliServerManager,
        name: string,
    ): void {
        const { writer } = context;
        const found = [...manager.connections.entries()].find(
            ([serverName]) => serverName.toLowerCase() === name.toLowerCase(),
        );
        if (!found) {
            writeUnknownServer(context, manager, name);
            return;
        }
        const [serverName, connection] = found;
        if (!connection.connected) {
            writer.writeError(`ssh: ${serverName} is unreachable.`);
            writer.writeInfo(
                `💡 Use ${writer.wrapInColor(`server status ${serverName}`, CliForegroundColor.Cyan)} to see why`,
            );
            return;
        }
        writer.writeError(`ssh: ${serverName} does not allow shell access.`);
        writer.writeln(
            '  The server has to enable its shell (enableShell / EnableShell / enable_shell) and let you use it.',
        );
        writer.writeln(
            `  See ${writer.wrapInColor('https://cli.qodalis.com/docs/server-integration', CliForegroundColor.Blue)}`,
        );
    }

    /** No server has a shell: say whether none is configured, connected or shell-enabled. */
    private writeNoShellServers(
        context: ICliExecutionContext,
        manager: CliServerManager,
    ): void {
        const { writer } = context;
        const all = [...manager.connections.entries()];
        if (all.length === 0) {
            writer.writeError('ssh: no servers are configured.');
            writeConfigureHint(context);
            return;
        }
        const connected = all.filter(([, c]) => c.connected).map(([n]) => n);
        if (connected.length === 0) {
            writer.writeError('ssh: no server is connected.');
            writer.writeInfo(
                `💡 Use ${writer.wrapInColor('server status', CliForegroundColor.Cyan)} to check them, ${writer.wrapInColor('server reconnect', CliForegroundColor.Cyan)} to retry`,
            );
            return;
        }
        writer.writeError(
            `ssh: none of the connected servers (${connected.join(', ')}) allow shell access.`,
        );
        writer.writeln(
            '  A server has to enable its shell (enableShell / EnableShell / enable_shell) for ssh.',
        );
    }

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        const { writer } = context;
        writeWrapped(
            context,
            t.t('cli.ssh.help.open_interactive_shell_server', 'Open an interactive shell on a server, in this terminal, or run one command there and print its output. Only servers that enable their shell can be used; with the users plugin you need the shell:execute permission. Without a name, ssh uses the only shell server, else the default server, else asks which one.'),
        );
        writer.writeln();
        writeUsage(context, [
            ['ssh', t.t('cli.ssh.help.shell_default_only_server', 'Shell on the default (or only) server')],
            ['ssh <name>', t.t('cli.ssh.help.shell_server_exit_ctrl', 'Shell on a server (exit or Ctrl+D to leave)')],
            ['ssh <name> <command>', t.t('cli.ssh.help.run_one_command_print', 'Run one command and print its output')],
            ['ssh --server=<name>', t.t('cli.ssh.help.same_ssh', 'Same as ssh <name>')],
        ]);
        writer.writeln();
        writeExamples(context, [
            ['ssh node', t.t('cli.ssh.help.interactive_shell_node', 'Interactive shell on node')],
            ['ssh node ls -la /tmp', t.t('cli.ssh.help.one_command_node', 'One command on node')],
            ['shell', t.t('cli.ssh.help.same_ssh_2', 'Same as ssh')],
        ]);
    }

    private async executeInteractive(
        connection: CliServerConnection,
        serverName: string,
        context: ICliExecutionContext,
    ): Promise<void> {
        const session: ShellSession = { socket: null, resolved: false, disposed: false };

        const cols = context.terminal.cols;
        const rows = context.terminal.rows;
        const wsUrl = await this.buildShellUrl(connection, cols, rows);

        context.spinner?.show(`Connecting to ${serverName}...`);

        let fullScreen = false;

        return new Promise<void>((resolve) => {
            const signal = context.signal;
            const resolveOnce = () => {
                signal?.removeEventListener('abort', onAbort);
                if (!session.resolved) {
                    session.resolved = true;
                    resolve();
                }
            };

            // Ctrl+C / kill: close the socket and give the terminal back
            const onAbort = () => {
                context.spinner?.hide();
                this.cleanup(session);
                if (fullScreen) context.exitFullScreenMode();
                context.process.exit(130, { silent: true });
                resolveOnce();
            };

            if (signal?.aborted) {
                onAbort();
                return;
            }
            signal?.addEventListener('abort', onAbort, { once: true });

            try {
                session.socket = new WebSocket(wsUrl);
            } catch (e: any) {
                context.spinner?.hide();
                context.writer.writeError(
                    `Failed to connect to '${serverName}': ${e.message}`,
                );
                context.process.exit(1, { silent: true });
                resolveOnce();
                return;
            }

            session.socket.onopen = () => {
                // Wait for 'ready' message before entering full-screen
            };

            session.socket.onmessage = (event) => {
                const msg = parseShellMessage(event.data);
                if (!msg) return;

                switch (msg.type) {
                    case 'ready':
                        context.spinner?.hide();
                        context.writer.writeInfo(
                            `Connected to ${serverName} (${msg.os}, ${msg.shell})`,
                        );
                        context.enterFullScreenMode(this.fullScreenHandler(session));
                        fullScreen = true;
                        // Reset terminal for shell: clear screen, cursor home, show cursor
                        context.terminal.write('\x1b[2J\x1b[H\x1b[?25h');
                        break;

                    case 'stdout':
                        context.terminal.write(msg.data);
                        break;

                    case 'stderr':
                        context.terminal.write(msg.data);
                        break;

                    case 'exit':
                        if (fullScreen) context.exitFullScreenMode();
                        context.writer.writeInfo(
                            `Shell exited with code ${msg.code}.`,
                        );
                        context.process.exit(msg.code, { silent: true });
                        this.cleanup(session);
                        resolveOnce();
                        break;

                    case 'error':
                        context.spinner?.hide();
                        if (fullScreen) context.exitFullScreenMode();
                        context.writer.writeError(
                            `Server error: ${msg.message}`,
                        );
                        context.process.exit(1, { silent: true });
                        this.cleanup(session);
                        resolveOnce();
                        break;
                }
            };

            // The close event carries the reason (auth, limits, timeout); an
            // error event is always followed by a close, so report there
            let errored = false;
            session.socket.onclose = (event?: CloseEvent) => {
                context.spinner?.hide();
                if (!session.disposed && !session.resolved) {
                    if (fullScreen) context.exitFullScreenMode();
                    const reason = describeShellClose(event ?? {}, serverName);
                    if (reason) context.writer.writeError(reason);
                    else if (errored) context.writer.writeError(`WebSocket error connecting to '${serverName}'.`);
                    else context.writer.writeWarning(`Connection to '${serverName}' closed.`);
                    context.process.exit(1, { silent: true });
                }
                this.cleanup(session);
                resolveOnce();
            };

            session.socket.onerror = () => {
                errored = true;
            };
        });
    }

    private async executeOneShot(
        connection: CliServerConnection,
        serverName: string,
        cmd: string,
        context: ICliExecutionContext,
    ): Promise<void> {
        const cols = context.terminal.cols;
        const rows = context.terminal.rows;
        const wsUrl = await this.buildShellUrl(connection, cols, rows, cmd);

        context.spinner?.show(`Running on ${serverName}...`);

        const session: ShellSession = { socket: null, resolved: false, disposed: false };
        return new Promise<void>((resolvePromise) => {
            const signal = context.signal;
            const resolve = () => {
                signal?.removeEventListener('abort', onAbort);
                resolvePromise();
            };

            // Ctrl+C / kill: stop the remote command and end this one
            const onAbort = () => {
                context.spinner?.hide();
                this.cleanup(session);
                context.process.exit(130, { silent: true });
                resolve();
            };

            if (signal?.aborted) {
                onAbort();
                return;
            }
            signal?.addEventListener('abort', onAbort, { once: true });

            try {
                session.socket = new WebSocket(wsUrl);
            } catch (e: any) {
                context.spinner?.hide();
                context.writer.writeError(
                    `Failed to connect to '${serverName}': ${e.message}`,
                );
                context.process.exit(1, { silent: true });
                resolve();
                return;
            }

            session.socket.onmessage = (event) => {
                const msg = parseShellMessage(event.data);
                if (!msg) return;

                switch (msg.type) {
                    case 'ready':
                        context.spinner?.hide();
                        break;

                    case 'stdout':
                        context.writer.writeln(msg.data);
                        break;

                    case 'stderr':
                        context.writer.writeError(msg.data);
                        break;

                    case 'exit':
                        if (msg.code !== 0) {
                            context.process.exit(msg.code, { silent: true });
                        }
                        this.cleanup(session);
                        resolve();
                        break;

                    case 'error':
                        context.spinner?.hide();
                        context.writer.writeError(
                            `Server error: ${msg.message}`,
                        );
                        context.process.exit(1, { silent: true });
                        this.cleanup(session);
                        resolve();
                        break;
                }
            };

            let errored = false;
            session.socket.onclose = (event?: CloseEvent) => {
                context.spinner?.hide();
                const reason = describeShellClose(event ?? {}, serverName);
                if (reason || errored) {
                    context.writer.writeError(reason ?? `WebSocket error connecting to '${serverName}'.`);
                    context.process.exit(1, { silent: true });
                }
                this.cleanup(session);
                resolve();
            };

            session.socket.onerror = () => {
                errored = true;
            };
        });
    }

    /** `ssh <server> <cmd...>` → `<cmd...>` exactly as typed */
    private remoteCommandFromRaw(raw: string | undefined, serverName: string): string | null {
        const match = raw?.trim().match(/^\S+\s+(\S+)\s+([\s\S]+)$/);
        return match && match[1] === serverName ? match[2].trim() : null;
    }

    private buildShellUrl(
        connection: CliServerConnection,
        cols: number,
        rows: number,
        cmd?: string,
    ): Promise<string> {
        let path = `/ws/v1/qcli/shell?cols=${cols}&rows=${rows}`;
        if (cmd) {
            path += `&cmd=${encodeURIComponent(cmd)}`;
        }
        return connection.buildWebSocketUrl(path);
    }

    private cleanup(session: ShellSession): void {
        const socket = session.socket;
        if (socket) {
            socket.onmessage = null;
            socket.onclose = null;
            socket.onerror = null;
            if (
                socket.readyState === WebSocket.OPEN ||
                socket.readyState === WebSocket.CONNECTING
            ) {
                socket.close();
            }
            session.socket = null;
        }
    }
}

/**
 * Message for a shell socket closed by the server with an application code
 * (servers accept, then close, so the browser can read why; reason texts are
 * the canonical ones from the server contract). `null` for a normal close.
 */
/** A server shell message, or null when the payload is not one (ignored) */
function parseShellMessage(data: unknown): ServerShellMessage | null {
    try {
        const msg = typeof data === 'string' ? JSON.parse(data) : null;
        return msg && typeof msg === 'object' && typeof msg.type === 'string' ? msg : null;
    } catch {
        return null;
    }
}

export function describeShellClose(event: { code?: number; reason?: string }, serverName: string): string | null {
    const reason = (event.reason ?? '').toLowerCase();
    switch (event.code) {
        case 4401:
            // Sent for logout/expiry/kick and for losing shell:execute while connected
            if (reason === 'session ended') return `ssh: shell closed by '${serverName}' (session ended or shell access revoked)`;
            if (reason === 'shell access is not configured') {
                return `ssh: shell access is not configured on '${serverName}'`;
            }
            return `ssh: login required on '${serverName}'`;
        case 4403:
            return `ssh: permission denied on '${serverName}' (requires shell:execute or a valid shell token)`;
        case 4404:
            return `ssh: the shell is disabled on '${serverName}'`;
        case 4408:
            return `ssh: shell timed out on '${serverName}'`;
        case 4429:
            return `ssh: too many shell sessions on '${serverName}'`;
        default:
            return null;
    }
}

/** The shell server called `name`, ignoring case. */
function findServer(
    servers: Array<{ name: string; connection: CliServerConnection }>,
    name: string,
): { name: string; connection: CliServerConnection } | undefined {
    const wanted = name.toLowerCase();
    return servers.find((s) => s.name.toLowerCase() === wanted);
}

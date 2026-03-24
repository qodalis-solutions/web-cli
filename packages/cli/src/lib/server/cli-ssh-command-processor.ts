import {
    CliProcessCommand,
    CliProcessorMetadata,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { CliServerConnection } from './cli-server-connection';
import { CliServerManager, CliServerManager_TOKEN } from './cli-server-manager';

type ShellMessage =
    | { type: 'stdin'; data: string }
    | { type: 'resize'; cols: number; rows: number };

type ServerShellMessage =
    | { type: 'stdout'; data: string }
    | { type: 'stderr'; data: string }
    | { type: 'exit'; code: number }
    | { type: 'error'; message: string }
    | { type: 'ready'; shell: string; os: string };

export class CliSshCommandProcessor implements ICliCommandProcessor {
    command = 'ssh';
    description = 'Open a remote shell session on a server';
    acceptsRawInput = true;
    valueRequired = false;
    metadata: CliProcessorMetadata = {
        module: '@qodalis/cli-server',
        icon: '\u{1F5A5}',
    };
    parameters?: ICliCommandParameterDescriptor[] = [
        {
            name: 'server',
            description: 'Name of the server to connect to',
            required: false,
            type: 'string',
        },
    ];

    private socket: WebSocket | null = null;
    private context: ICliExecutionContext | null = null;
    private resolved = false;

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const manager = context.services.get<CliServerManager>(
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
            context.writer.writeError(
                'No servers with shell access are available.',
            );
            context.process.exit(1);
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

    async onData(data: string, context: ICliExecutionContext): Promise<void> {
        if (this.socket?.readyState === WebSocket.OPEN) {
            const msg: ShellMessage = { type: 'stdin', data };
            this.socket.send(JSON.stringify(msg));
        }
    }

    onResize(
        cols: number,
        rows: number,
        _context: ICliExecutionContext,
    ): void {
        if (this.socket?.readyState === WebSocket.OPEN) {
            const msg: ShellMessage = { type: 'resize', cols, rows };
            this.socket.send(JSON.stringify(msg));
        }
    }

    onDispose(_context: ICliExecutionContext): void {
        if (this.socket) {
            if (
                this.socket.readyState === WebSocket.OPEN ||
                this.socket.readyState === WebSocket.CONNECTING
            ) {
                this.socket.close();
            }
            this.socket = null;
        }
        this.context = null;
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
        const argServer = command.args?.['server'] as string | undefined;
        if (argServer && typeof argServer === 'string') {
            const entry = shellServers.find((s) => s.name === argServer);
            if (!entry) {
                context.writer.writeError(
                    `Server '${argServer}' not found or does not support shell access.`,
                );
                context.process.exit(1);
                return empty;
            }
            // One-shot command comes from command.value (text after "ssh" excluding flags)
            // Not applicable with --server=name since value would be empty
            return {
                serverName: argServer,
                oneShotCmd: null,
                connection: entry.connection,
            };
        }

        // 2. Check positional value: "ssh dotnet" or "ssh dotnet ls -la"
        const value = command.value?.trim();
        if (value) {
            const parts = value.split(/\s+/);
            const candidateName = parts[0];
            const entry = shellServers.find((s) => s.name === candidateName);
            if (entry) {
                const oneShotCmd = parts.slice(1).join(' ') || null;
                return {
                    serverName: candidateName,
                    oneShotCmd,
                    connection: entry.connection,
                };
            }
            // Value doesn't match any server — treat as error
            context.writer.writeError(
                `Server '${candidateName}' not found or does not support shell access.`,
            );
            context.process.exit(1);
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
        const manager = context.services.get<CliServerManager>(
            CliServerManager_TOKEN,
        );
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

    private async executeInteractive(
        connection: CliServerConnection,
        serverName: string,
        context: ICliExecutionContext,
    ): Promise<void> {
        this.context = context;

        const cols = context.terminal.cols;
        const rows = context.terminal.rows;
        const wsUrl = this.buildShellUrl(connection, cols, rows);

        context.spinner?.show(`Connecting to ${serverName}...`);

        this.resolved = false;

        return new Promise<void>((resolve) => {
            const resolveOnce = () => {
                if (!this.resolved) {
                    this.resolved = true;
                    resolve();
                }
            };

            try {
                this.socket = new WebSocket(wsUrl);
            } catch (e: any) {
                context.spinner?.hide();
                context.writer.writeError(
                    `Failed to connect to '${serverName}': ${e.message}`,
                );
                context.process.exit(1);
                resolveOnce();
                return;
            }

            this.socket.onopen = () => {
                // Wait for 'ready' message before entering full-screen
            };

            this.socket.onmessage = (event) => {
                const msg = JSON.parse(event.data) as ServerShellMessage;

                switch (msg.type) {
                    case 'ready':
                        context.spinner?.hide();
                        context.writer.writeInfo(
                            `Connected to ${serverName} (${msg.os}, ${msg.shell})`,
                        );
                        context.enterFullScreenMode(this);
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
                        context.exitFullScreenMode();
                        context.writer.writeInfo(
                            `Shell exited with code ${msg.code}.`,
                        );
                        context.process.exit(msg.code);
                        this.cleanup();
                        resolveOnce();
                        break;

                    case 'error':
                        context.spinner?.hide();
                        context.exitFullScreenMode();
                        context.writer.writeError(
                            `Server error: ${msg.message}`,
                        );
                        context.process.exit(1);
                        this.cleanup();
                        resolveOnce();
                        break;
                }
            };

            this.socket.onclose = () => {
                context.spinner?.hide();
                if (this.context && !this.resolved) {
                    context.exitFullScreenMode();
                    context.writer.writeWarning(
                        `Connection to '${serverName}' closed.`,
                    );
                    context.process.exit(1);
                }
                this.cleanup();
                resolveOnce();
            };

            this.socket.onerror = () => {
                context.spinner?.hide();
                if (!this.resolved) {
                    context.writer.writeError(
                        `WebSocket error connecting to '${serverName}'.`,
                    );
                    context.process.exit(1);
                }
                this.cleanup();
                resolveOnce();
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
        const wsUrl = this.buildShellUrl(connection, cols, rows, cmd);

        context.spinner?.show(`Running on ${serverName}...`);

        return new Promise<void>((resolve) => {
            try {
                this.socket = new WebSocket(wsUrl);
            } catch (e: any) {
                context.spinner?.hide();
                context.writer.writeError(
                    `Failed to connect to '${serverName}': ${e.message}`,
                );
                context.process.exit(1);
                resolve();
                return;
            }

            this.socket.onmessage = (event) => {
                const msg = JSON.parse(event.data) as ServerShellMessage;

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
                            context.process.exit(msg.code);
                        }
                        this.cleanup();
                        resolve();
                        break;

                    case 'error':
                        context.spinner?.hide();
                        context.writer.writeError(
                            `Server error: ${msg.message}`,
                        );
                        context.process.exit(1);
                        this.cleanup();
                        resolve();
                        break;
                }
            };

            this.socket.onclose = () => {
                context.spinner?.hide();
                this.cleanup();
                resolve();
            };

            this.socket.onerror = () => {
                context.spinner?.hide();
                context.writer.writeError(
                    `WebSocket error connecting to '${serverName}'.`,
                );
                context.process.exit(1);
                this.cleanup();
                resolve();
            };
        });
    }

    private buildShellUrl(
        connection: CliServerConnection,
        cols: number,
        rows: number,
        cmd?: string,
    ): string {
        const baseUrl = connection.config.url.endsWith('/')
            ? connection.config.url.slice(0, -1)
            : connection.config.url;
        const wsBase = baseUrl
            .replace(/^https:/, 'wss:')
            .replace(/^http:/, 'ws:');

        let url = `${wsBase}/ws/v1/qcli/shell?cols=${cols}&rows=${rows}`;
        if (cmd) {
            url += `&cmd=${encodeURIComponent(cmd)}`;
        }
        return url;
    }

    private cleanup(): void {
        if (this.socket) {
            this.socket.onmessage = null;
            this.socket.onclose = null;
            this.socket.onerror = null;
            if (
                this.socket.readyState === WebSocket.OPEN ||
                this.socket.readyState === WebSocket.CONNECTING
            ) {
                this.socket.close();
            }
            this.socket = null;
        }
        this.context = null;
    }
}

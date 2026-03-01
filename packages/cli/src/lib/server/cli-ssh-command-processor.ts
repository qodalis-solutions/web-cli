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

        // Determine which server to connect to
        let serverName = command.value;
        let connection: CliServerConnection | undefined;

        if (serverName) {
            const entry = shellServers.find((s) => s.name === serverName);
            if (!entry) {
                context.writer.writeError(
                    `Server '${serverName}' not found or does not support shell access.`,
                );
                context.process.exit(1);
                return;
            }
            connection = entry.connection;
        } else if (shellServers.length === 1) {
            serverName = shellServers[0].name;
            connection = shellServers[0].connection;
        } else {
            const selected = await context.reader.readSelectInline(
                'Select a server for shell access:',
                shellServers.map((s) => ({
                    label: s.name,
                    value: s.name,
                })),
            );
            if (!selected) {
                context.writer.writeInfo('Shell cancelled.');
                return;
            }
            serverName = selected;
            connection = shellServers.find(
                (s) => s.name === selected,
            )!.connection;
        }

        // Check for one-shot mode: ssh <server> <command>
        const rawCmd = command.rawCommand ?? '';
        const oneShotCmd = this.extractOneShotCommand(rawCmd, serverName!);

        if (oneShotCmd) {
            await this.executeOneShot(
                connection!,
                serverName!,
                oneShotCmd,
                context,
            );
        } else {
            await this.executeInteractive(
                connection!,
                serverName!,
                context,
            );
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

    private extractOneShotCommand(
        rawCommand: string,
        serverName: string,
    ): string | null {
        // rawCommand is the full input, e.g. "ssh dotnet ls -la"
        // Strip "ssh" prefix and optional server name
        let rest = rawCommand.replace(/^ssh\s+/, '');
        if (rest.startsWith(serverName)) {
            rest = rest.slice(serverName.length).trim();
        }
        return rest.length > 0 ? rest : null;
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
                        if (msg.code !== 0) {
                            context.process.exit(msg.code);
                        }
                        this.cleanup();
                        resolve();
                        break;

                    case 'error':
                        context.spinner?.hide();
                        context.exitFullScreenMode();
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
                if (this.context) {
                    context.exitFullScreenMode();
                    context.writer.writeWarning(
                        `Connection to '${serverName}' closed.`,
                    );
                }
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

        let url = `${wsBase}/ws/v1/cli/shell?cols=${cols}&rows=${rows}`;
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

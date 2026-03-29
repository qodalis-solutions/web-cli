import {
    CliServerConfig,
    ICliBackgroundServiceRegistry,
    ICliCommandProcessorRegistry,
    ICliLogger,
    ICliServerAuthService,
} from '@qodalis/cli-core';
import { CliServerConnection } from './cli-server-connection';
import { CliServerProxyProcessor } from './cli-server-proxy-processor';
import {
    CliServerMultiProxyProcessor,
    DefaultServerProvider,
} from './cli-server-multi-proxy-processor';

export const CliServerManager_TOKEN = 'cli-server-manager';

export class CliServerManager implements DefaultServerProvider {
    readonly connections = new Map<string, CliServerConnection>();
    private _logger?: { warn(msg: string): void; info(msg: string): void };
    private _cliLogger?: ICliLogger;
    private _defaultServer: string | null = null;
    private _backgroundServices?: ICliBackgroundServiceRegistry;

    constructor(
        private readonly registry: ICliCommandProcessorRegistry,
        private readonly authService?: ICliServerAuthService,
    ) {}

    get defaultServer(): string | null {
        return this._defaultServer;
    }

    setDefaultServer(name: string | null): void {
        if (name !== null && !this.connections.has(name)) {
            throw new Error(`Unknown server: ${name}`);
        }
        this._defaultServer = name;
        // Re-register bare aliases with the new preference
        this.unregisterBareAliases();
        this.registerBareAliases();
    }

    async connectAll(
        servers: CliServerConfig[],
        logger?: { warn(msg: string): void; info(msg: string): void },
        backgroundServices?: ICliBackgroundServiceRegistry,
        cliLogger?: ICliLogger,
    ): Promise<void> {
        this._logger = logger;
        this._cliLogger = cliLogger;
        this._backgroundServices = backgroundServices;

        for (const config of servers) {
            if (config.enabled === false) continue;

            const connection = new CliServerConnection(config, backgroundServices, cliLogger, this.authService);
            this.connections.set(config.name, connection);

            connection.onDisconnect = () => {
                this.handleDisconnect(config.name);
            };

            connection.onReconnected = () => {
                logger?.info(
                    `Server '${config.name}' reconnected (${connection.commands.length} commands, API v${connection.apiVersion}).`,
                );
                this.registerProxyProcessors(connection, config.name);
                this.unregisterBareAliases();
                this.registerBareAliases();
            };

            await connection.connect();

            if (connection.connected) {
                logger?.info(
                    `Connected to server '${config.name}' (${connection.commands.length} commands)`,
                );
                this.registerProxyProcessors(connection, config.name);
            } else {
                logger?.warn(
                    `Could not connect to server '${config.name}' at ${config.url}. Commands from this server will not be available.`,
                );
            }
        }

        this.registerBareAliases();
    }

    async reconnect(
        name: string,
    ): Promise<{ success: boolean; commandCount: number }> {
        const connection = this.connections.get(name);
        if (!connection) {
            return { success: false, commandCount: 0 };
        }

        connection.stopHealthCheck();
        this.unregisterServerProcessors(name);

        connection.onDisconnect = () => {
            this.handleDisconnect(name);
        };

        connection.onReconnected = () => {
            this._logger?.info(
                `Server '${name}' reconnected (${connection.commands.length} commands, API v${connection.apiVersion}).`,
            );
            this.registerProxyProcessors(connection, name);
            this.unregisterBareAliases();
            this.registerBareAliases();
        };

        await connection.connect();

        if (connection.connected) {
            this.registerProxyProcessors(connection, name);
            this.registerBareAliases();
            return { success: true, commandCount: connection.commands.length };
        }

        return { success: false, commandCount: 0 };
    }

    getConnection(name: string): CliServerConnection | undefined {
        return this.connections.get(name);
    }

    private handleDisconnect(name: string): void {
        this._logger?.warn(
            `Server '${name}' disconnected. Its commands are no longer available. Starting health check...`,
        );
        this.unregisterServerProcessors(name);

        const connection = this.connections.get(name);
        if (connection) {
            connection.startHealthCheck();
        }
    }

    private unregisterServerProcessors(name: string): void {
        // Unregister namespaced processors
        const prefix = `${name}:`;
        const namespaced = this.registry.processors.filter((p) =>
            p.command.startsWith(prefix),
        );
        for (const p of namespaced) {
            this.registry.unregisterProcessor(p);
        }

        // Unregister bare aliases (single-server and multi-server)
        this.unregisterBareAliases();
        // Re-register bare aliases for remaining connected servers
        this.registerBareAliases();
    }

    private unregisterBareAliases(): void {
        for (const p of [...this.registry.processors]) {
            if (
                p.metadata?.module === 'server:multi' ||
                (p.metadata?.requireServer &&
                    !p.command.includes(':'))
            ) {
                this.registry.unregisterProcessor(p);
            }
        }
    }

    private registerProxyProcessors(
        connection: CliServerConnection,
        serverName: string,
    ): void {
        for (const descriptor of connection.commands) {
            const proxy = new CliServerProxyProcessor(
                connection,
                descriptor,
                serverName,
            );
            this.registry.registerProcessor(proxy);
        }
    }

    private registerBareAliases(): void {
        const commandCounts = new Map<string, string[]>();

        for (const [serverName, connection] of this.connections) {
            if (!connection.connected) continue;
            for (const cmd of connection.commands) {
                const existing = commandCounts.get(cmd.command) ?? [];
                existing.push(serverName);
                commandCounts.set(cmd.command, existing);
            }
        }

        for (const [command, servers] of commandCounts) {
            const existingProcessor = this.registry.findProcessor(command, []);

            // Only register bare alias if no local processor owns this command
            if (existingProcessor && !existingProcessor.metadata?.requireServer)
                continue;

            if (servers.length === 1) {
                const serverName = servers[0];
                const namespacedCommand = `${serverName}:${command}`;

                const namespacedProcessor = this.registry.findProcessor(
                    namespacedCommand,
                    [],
                );
                if (!namespacedProcessor) continue;

                const connection = this.connections.get(serverName)!;
                const descriptor = connection.commands.find(
                    (c) => c.command === command,
                )!;
                const alias = new CliServerProxyProcessor(
                    connection,
                    descriptor,
                    serverName,
                );
                alias.command = command;
                alias.aliases = [namespacedCommand];

                this.registry.registerProcessor(alias);
            } else {
                // Command exists on multiple servers — register a multi-proxy
                const entries = servers.map((serverName) => {
                    const connection = this.connections.get(serverName)!;
                    const descriptor = connection.commands.find(
                        (c) => c.command === command,
                    )!;
                    return { serverName, connection, descriptor };
                });
                const multi = new CliServerMultiProxyProcessor(entries, this);
                this.registry.registerProcessor(multi);
            }
        }
    }
}

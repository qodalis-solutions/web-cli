import { createCliToken } from '@qodalis/cli-core';
import {
    CliServerCommandDescriptor,
    CliServerConfig,
    ICliBackgroundServiceRegistry,
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
    ICliLogger,
    ICliServerAuthService,
    ICliEventBus,
} from '@qodalis/cli-core';
import { CliServerConnection } from './cli-server-connection';
import { CliServerProxyProcessor } from './cli-server-proxy-processor';
import {
    CliServerMultiProxyProcessor,
    DefaultServerProvider,
} from './cli-server-multi-proxy-processor';
import { serverCommandAliases } from './cli-server-command-metadata';

export const CliServerManager_TOKEN =
    createCliToken<CliServerManager>('cli-server-manager');

/** A server command whose bare name a local command already has */
export interface CliHiddenServerCommand {
    /** Server that provides the command */
    server: string;
    /** The server command's name */
    command: string;
    /** The local command that owns the name (its name, not the alias) */
    localCommand: string;
}

export class CliServerManager implements DefaultServerProvider {
    readonly connections = new Map<string, CliServerConnection>();
    private _logger?: { warn(msg: string): void; info(msg: string): void };
    private _cliLogger?: ICliLogger;
    private _defaultServer: string | null = null;
    /** Bare-name aliases this manager registered (only these are ever removed) */
    private readonly _bareAliases = new Set<ICliCommandProcessor>();
    private _backgroundServices?: ICliBackgroundServiceRegistry;
    private _hidden: CliHiddenServerCommand[] = [];
    /** Servers the user linked (`server add`), as opposed to the host's */
    private readonly _linked = new Set<string>();
    /** `server:command` pairs already warned about, so each warns once */
    private readonly _warnedHidden = new Set<string>();

    constructor(
        private readonly registry: ICliCommandProcessorRegistry,
        private readonly authService?: ICliServerAuthService,
        private readonly events?: ICliEventBus,
    ) {}

    /** Whether the user linked this server (`server add`): only those can be removed or edited. */
    isLinked(name: string): boolean {
        return this._linked.has(name);
    }

    get defaultServer(): string | null {
        return this._defaultServer;
    }

    preferredServer(): string | null {
        if (
            this._defaultServer &&
            this.connections.get(this._defaultServer)?.connected
        ) {
            return this._defaultServer;
        }
        for (const [name, connection] of this.connections) {
            if (connection.connected) return name;
        }
        return null;
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

    /** Where connections report and run (set once at boot, before any server connects). */
    configure(
        logger?: { warn(msg: string): void; info(msg: string): void },
        backgroundServices?: ICliBackgroundServiceRegistry,
        cliLogger?: ICliLogger,
    ): void {
        this._logger = logger;
        this._cliLogger = cliLogger;
        this._backgroundServices = backgroundServices;
    }

    async connectAll(
        servers: CliServerConfig[],
        logger?: { warn(msg: string): void; info(msg: string): void },
        backgroundServices?: ICliBackgroundServiceRegistry,
        cliLogger?: ICliLogger,
    ): Promise<void> {
        this.configure(logger, backgroundServices, cliLogger);

        for (const config of servers) {
            if (config.enabled === false) continue;
            await this.connectServer(config);
        }

        this.registerBareAliases();
    }

    /**
     * Connects one server and registers its commands (without the bare
     * aliases: callers refresh them once every server is connected).
     */
    private async connectServer(config: CliServerConfig): Promise<CliServerConnection> {
        const logger = this._logger;
        const connection = new CliServerConnection(
            config,
            this._backgroundServices,
            this._cliLogger,
            this.authService,
        );
        this.connections.set(config.name, connection);

        connection.onDisconnect = () => {
            this.handleDisconnect(config.name);
        };

        connection.onReconnected = () => {
            logger?.info(
                `Server '${config.name}' reconnected (${connection.commands.length} commands, API v${connection.apiVersion}).`,
            );
            this.emitConnected(connection, true);
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
            this.emitConnected(connection, false);
        } else if (connection.needsSignIn) {
            // Up, but its commands need a sign-in: the users plugin (or a
            // `server reconnect` after `login`) connects it then. Often the
            // sign-in is already there and only boots after this request.
            logger?.info(
                `Server '${config.name}' needs a sign-in; its commands load once you are signed in.`,
            );
        } else {
            logger?.warn(
                `Could not connect to server '${config.name}' at ${config.url}. Commands from this server will not be available.`,
            );
            this.events?.emit('server:unavailable', {
                name: config.name,
                url: config.url,
            });
        }
        return connection;
    }

    /**
     * Connects a server added while the terminal runs (`server add`): its
     * commands are available at once. Throws when the name is taken.
     */
    async addServer(
        config: CliServerConfig,
        options: { linked?: boolean } = {},
    ): Promise<CliServerConnection> {
        if (this.connections.has(config.name)) {
            throw new Error(`Server '${config.name}' already exists`);
        }
        if (options.linked) this._linked.add(config.name);
        const connection = await this.connectServer(config);
        this.unregisterBareAliases();
        this.registerBareAliases();
        return connection;
    }

    /**
     * Disconnects a server and forgets it (`server remove`): its commands go
     * away. False when there is no such server.
     */
    removeServer(name: string): boolean {
        const connection = this.connections.get(name);
        if (!connection) return false;
        connection.onDisconnect = undefined;
        connection.onReconnected = undefined;
        connection.disconnect();
        this.connections.delete(name);
        this._linked.delete(name);
        if (this._defaultServer === name) this._defaultServer = null;
        this.unregisterServerProcessors(name);
        this.events?.emit('server:disconnected', { name });
        return true;
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
            this.emitConnected(connection, true);
            this.registerProxyProcessors(connection, name);
            this.unregisterBareAliases();
            this.registerBareAliases();
        };

        await connection.connect();

        if (connection.connected) {
            this.registerProxyProcessors(connection, name);
            this.unregisterBareAliases();
            this.registerBareAliases();
            this.emitConnected(connection, true);
            return { success: true, commandCount: connection.commands.length };
        }

        return { success: false, commandCount: 0 };
    }

    /**
     * Server commands a local command hides: reachable only as
     * `<server>:<command>` (see `server commands`).
     */
    get hiddenCommands(): readonly CliHiddenServerCommand[] {
        return this._hidden;
    }

    getConnection(name: string): CliServerConnection | undefined {
        return this.connections.get(name);
    }

    private emitConnected(
        connection: CliServerConnection,
        reconnected: boolean,
    ): void {
        this.events?.emit('server:connected', {
            name: connection.config.name,
            url: connection.config.url,
            commands: connection.commands.length,
            reconnected,
        });
    }

    private handleDisconnect(name: string): void {
        this.events?.emit('server:disconnected', { name });
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
        // Only the aliases created here: local processors that merely declare
        // `requireServer` (e.g. data-explorer) must survive reconnects
        // `unregisterProcessor` removes by command name: skip aliases that a
        // local processor has since replaced, or that one would be removed
        for (const p of this._bareAliases) {
            if (this.registry.processors.includes(p)) {
                this.registry.unregisterProcessor(p);
            }
        }
        this._bareAliases.clear();
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
        this._hidden = [];

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
            if (
                existingProcessor &&
                !this._bareAliases.has(existingProcessor)
            ) {
                for (const server of servers) {
                    this.recordHidden(
                        server,
                        command,
                        existingProcessor.command,
                    );
                }
                continue;
            }

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
                alias.aliases = [namespacedCommand, ...this.freeAliases(descriptor)];

                this.registry.registerProcessor(alias);
                this._bareAliases.add(alias);
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
                const aliases = this.freeAliases(entries[0].descriptor);
                if (aliases.length) multi.aliases = aliases;
                this.registry.registerProcessor(multi);
                this._bareAliases.add(multi);
            }
        }
    }

    /**
     * The server's aliases of a command that no registered command answers
     * to yet: a local command (or an earlier server alias) keeps its name.
     */
    private freeAliases(descriptor: CliServerCommandDescriptor): string[] {
        return serverCommandAliases(descriptor).filter((a) => !this.registry.findProcessor(a, []));
    }

    private recordHidden(
        server: string,
        command: string,
        localCommand: string,
    ): void {
        this._hidden.push({ server, command, localCommand });
        const key = `${server}:${command}`;
        if (this._warnedHidden.has(key)) return;
        this._warnedHidden.add(key);
        const owner =
            localCommand === command
                ? `a local command of the same name`
                : `local "${localCommand}"`;
        this._logger?.warn(
            `Server command "${command}" from "${server}" is hidden by ${owner}; use "${key}".`,
        );
    }
}

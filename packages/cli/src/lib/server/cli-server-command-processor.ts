import {
    CliProcessCommand,
    CliIcon,
    ICliCommandProcessor,
    ICliCommandChildProcessor,
    ICliCommandParameterDescriptor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { CliServerManager, CliServerManager_TOKEN } from './cli-server-manager';

export class CliServerCommandProcessor implements ICliCommandProcessor {
    command = 'server';
    description = 'Manage remote CLI server connections';
    metadata = {
        icon: CliIcon.Server,
        module: '@qodalis/cli-server',
        sealed: true,
    };
    processors: ICliCommandChildProcessor[] = [
        new ServerListProcessor(),
        new ServerStatusProcessor(),
        new ServerReconnectProcessor(),
        new ServerDefaultProcessor(),
    ];

    async processCommand(
        _command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.writer.writeln(
            'Usage: server <list|status|reconnect|default>',
        );
        context.writer.writeln('Run "help server" for details.');
    }
}

class ServerListProcessor implements ICliCommandChildProcessor {
    command = 'list';
    description = 'Show configured servers and their connection status';
    parent?: ICliCommandProcessor;

    async processCommand(
        _command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const manager = context.services.getRequired<CliServerManager>(
            CliServerManager_TOKEN,
        );

        if (!manager || manager.connections.size === 0) {
            context.writer.writeInfo('No servers configured.');
            return;
        }

        const headers = ['Name', 'URL', 'Status', 'API', 'Commands'];
        const rows: string[][] = [];
        const defaultServer = manager.defaultServer;

        for (const [name, connection] of manager.connections) {
            const isDefault = name === defaultServer;
            rows.push([
                isDefault ? `${name} *` : name,
                connection.config.url,
                connection.connected ? 'Connected' : 'Disconnected',
                connection.connected ? `v${connection.apiVersion}` : '-',
                connection.connected ? String(connection.commands.length) : '-',
            ]);
        }

        context.writer.writeTable(headers, rows);

        if (defaultServer) {
            context.writer.writeInfo('* = default server');
        }
    }
}

class ServerStatusProcessor implements ICliCommandChildProcessor {
    command = 'status';
    description = 'Ping a server and show its version';
    valueRequired = true;
    parent?: ICliCommandProcessor;

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const serverName = command.value;
        if (!serverName) {
            context.writer.writeError('Usage: server status <server-name>');
            context.process.exit(1);
            return;
        }

        const manager = context.services.getRequired<CliServerManager>(
            CliServerManager_TOKEN,
        );
        const connection = manager?.getConnection(serverName);

        if (!connection) {
            context.writer.writeError(`Unknown server: ${serverName}`);
            context.process.exit(1);
            return;
        }

        context.spinner?.show(`Pinging ${serverName}...`);
        context.setStatusText(`Pinging ${serverName}`);
        const reachable = await connection.ping();
        context.spinner?.hide();

        if (reachable) {
            context.writer.writeSuccess(`Server '${serverName}' is reachable`);
            context.writer.writeKeyValue({
                URL: connection.config.url,
                Connected: String(connection.connected),
                'API Version': connection.connected ? `v${connection.apiVersion}` : 'unknown',
                Commands: String(connection.commands.length),
            });
        } else {
            context.writer.writeError(
                `Server '${serverName}' is not reachable at ${connection.config.url}`,
            );
        }
    }
}

class ServerReconnectProcessor implements ICliCommandChildProcessor {
    command = 'reconnect';
    description = 'Re-fetch commands from a server';
    valueRequired = true;
    parent?: ICliCommandProcessor;

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const serverName = command.value;
        if (!serverName) {
            context.writer.writeError('Usage: server reconnect <server-name>');
            context.process.exit(1);
            return;
        }

        const manager = context.services.getRequired<CliServerManager>(
            CliServerManager_TOKEN,
        );

        if (!manager) {
            context.writer.writeError('Server manager not available.');
            context.process.exit(1);
            return;
        }

        context.spinner?.show(`Reconnecting to ${serverName}...`);
        context.setStatusText(`Reconnecting to ${serverName}`);
        const result = await manager.reconnect(serverName);
        context.spinner?.hide();

        if (result.success) {
            context.writer.writeSuccess(
                `Reconnected to '${serverName}'. ${result.commandCount} commands available.`,
            );
        } else {
            context.writer.writeError(
                `Could not reconnect to '${serverName}'.`,
            );
            context.process.exit(1);
        }
    }
}

class ServerDefaultProcessor implements ICliCommandChildProcessor {
    command = 'default';
    description = 'Get or set the default server for ambiguous commands';
    acceptsRawInput = true;
    parent?: ICliCommandProcessor;
    parameters?: ICliCommandParameterDescriptor[] = [
        {
            name: '--clear',
            description: 'Remove default server preference',
            required: false,
            type: 'boolean',
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

        if (command.args?.['clear']) {
            manager.setDefaultServer(null);
            context.writer.writeSuccess('Default server cleared.');
            return;
        }

        const serverName = command.value;
        if (!serverName) {
            const current = manager.defaultServer;
            if (current) {
                context.writer.writeInfo(`Default server: ${current}`);
            } else {
                context.writer.writeInfo(
                    'No default server set. Run "server default <name>" to set one.',
                );
            }
            return;
        }

        try {
            manager.setDefaultServer(serverName);
            context.writer.writeSuccess(
                `Default server set to '${serverName}'.`,
            );
        } catch {
            context.writer.writeError(`Unknown server: ${serverName}`);
            context.process.exit(1);
        }
    }
}

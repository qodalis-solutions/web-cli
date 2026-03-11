import {
    CliProcessCommand,
    CliProcessorMetadata,
    CliServerCommandDescriptor,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { CliServerConnection } from './cli-server-connection';
import { executeOnServer } from './cli-server-proxy-processor';

export interface MultiProxyEntry {
    serverName: string;
    connection: CliServerConnection;
    descriptor: CliServerCommandDescriptor;
}

export interface DefaultServerProvider {
    readonly defaultServer: string | null;
}

/**
 * Proxy processor registered as a bare alias when the same command
 * exists on multiple connected servers.  Dispatches to the default
 * server when one is set, prompts the user otherwise, and falls back
 * to the next reachable server when the preferred one is down.
 */
export class CliServerMultiProxyProcessor implements ICliCommandProcessor {
    command: string;
    description?: string;
    metadata?: CliProcessorMetadata;
    parameters?: ICliCommandParameterDescriptor[];
    processors?: ICliCommandProcessor[];

    constructor(
        private readonly entries: MultiProxyEntry[],
        private readonly provider: DefaultServerProvider,
    ) {
        const first = entries[0].descriptor;
        this.command = first.command;
        this.description = first.description;
        this.metadata = {
            module: 'server:multi',
            icon: '\u{1F5A5}',
            requireServer: true,
        };
        this.parameters = first.parameters?.map((p) => ({
            name: p.name,
            aliases: p.aliases,
            description: p.description,
            required: p.required,
            type: p.type,
            defaultValue: p.defaultValue,
        }));
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const defaultServer = this.provider.defaultServer;

        if (defaultServer) {
            // Try default server first
            const entry = this.entries.find(
                (e) =>
                    e.serverName === defaultServer && e.connection.connected,
            );
            if (entry) {
                return executeOnServer(
                    entry.connection,
                    entry.serverName,
                    entry.descriptor,
                    command,
                    context,
                );
            }

            // Default is down — fall through to next connected server
            const fallback = this.entries.find(
                (e) => e.connection.connected,
            );
            if (fallback) {
                context.writer.writeWarning(
                    `Default server '${defaultServer}' is unreachable, falling back to '${fallback.serverName}'.`,
                );
                return executeOnServer(
                    fallback.connection,
                    fallback.serverName,
                    fallback.descriptor,
                    command,
                    context,
                );
            }

            context.writer.writeError(
                'No servers are reachable for this command.',
            );
            context.process.exit(1);
            return;
        }

        // No default — determine connected servers
        const connected = this.entries.filter(
            (e) => e.connection.connected,
        );

        if (connected.length === 0) {
            context.writer.writeError(
                'No servers are reachable for this command.',
            );
            context.process.exit(1);
            return;
        }

        if (connected.length === 1) {
            return executeOnServer(
                connected[0].connection,
                connected[0].serverName,
                connected[0].descriptor,
                command,
                context,
            );
        }

        // Prompt the user to pick a server
        const selected = await context.reader.readSelectInline(
            `'${this.command}' exists on multiple servers:`,
            connected.map((e) => ({
                label: e.serverName,
                value: e.serverName,
            })),
        );

        if (!selected) {
            context.writer.writeInfo('Command cancelled.');
            return;
        }

        const entry = connected.find((e) => e.serverName === selected)!;
        return executeOnServer(
            entry.connection,
            entry.serverName,
            entry.descriptor,
            command,
            context,
        );
    }
}

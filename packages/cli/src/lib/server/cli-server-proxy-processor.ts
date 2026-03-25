import {
    CliProcessCommand,
    CliProcessorMetadata,
    CliServerCommandDescriptor,
    CliServerOutput,
    CliServerResponse,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { CliServerConnection } from './cli-server-connection';

/**
 * Render a single CliServerOutput to the terminal.
 */
export function renderSingleOutput(
    output: CliServerOutput,
    context: ICliExecutionContext,
): void {
    switch (output.type) {
        case 'text': {
            const style = output.style;
            if (style === 'success')
                context.writer.writeSuccess(output.value);
            else if (style === 'error')
                context.writer.writeError(output.value);
            else if (style === 'info')
                context.writer.writeInfo(output.value);
            else if (style === 'warning')
                context.writer.writeWarning(output.value);
            else context.writer.writeln(output.value);
            break;
        }
        case 'table':
            context.writer.writeTable(output.headers, output.rows);
            break;
        case 'list':
            context.writer.writeList(output.items, {
                ordered: output.ordered,
            });
            break;
        case 'json':
            context.writer.writeJson(output.value);
            break;
        case 'key-value': {
            const record: Record<string, string> = {};
            for (const e of output.entries) {
                record[e.key] = e.value;
            }
            context.writer.writeKeyValue(record);
            break;
        }
    }
}

/**
 * Render a CliServerResponse to the terminal.
 */
export function renderServerResponse(
    response: CliServerResponse,
    context: ICliExecutionContext,
): void {
    for (const output of response.outputs ?? []) {
        renderSingleOutput(output, context);
    }

    if (response.exitCode !== 0) {
        context.process.exit(response.exitCode);
    }
}

/**
 * Execute a command on a specific server connection and render the response.
 * Shared by both single-proxy and multi-proxy processors.
 */
export async function executeOnServer(
    connection: CliServerConnection,
    serverName: string,
    descriptor: CliServerCommandDescriptor,
    command: CliProcessCommand,
    context: ICliExecutionContext,
    commandPath?: string[],
): Promise<void> {
    if (!connection.connected) {
        context.writer.writeError(
            `Server '${serverName}' is not reachable. Run 'server reconnect ${serverName}' to retry.`,
        );
        context.process.exit(1);
        return;
    }

    // Build server command with full path: first element is the root command,
    // remaining elements are chainCommands for sub-processor traversal.
    const serverCommand: CliProcessCommand = {
        ...command,
        command: commandPath && commandPath.length > 0 ? commandPath[0] : descriptor.command,
        chainCommands: commandPath && commandPath.length > 1 ? commandPath.slice(1) : [],
    };

    const cmdLabel = commandPath && commandPath.length > 0 ? commandPath.join(' ') : descriptor.command;
    context.setStatusText(`executing command: ${cmdLabel} on server ${serverName}`);

    try {
        if (connection.capabilities?.streaming) {
            // Streaming mode — render outputs as they arrive
            const result = await connection.executeStream(
                serverCommand,
                (output) => renderSingleOutput(output, context),
            );
            if (result.exitCode !== 0) {
                context.process.exit(result.exitCode);
            }
        } else {
            // Legacy mode — wait for full response
            context.spinner?.show('Executing on server...');
            const response = await connection.execute(serverCommand);
            context.spinner?.hide();
            renderServerResponse(response, context);
        }
    } catch (e: any) {
        context.spinner?.hide();
        if (e.name === 'AbortError') {
            context.writer.writeError(
                `Request to server '${serverName}' timed out after ${connection.config.timeout ?? 30000}ms.`,
            );
        } else {
            context.writer.writeError(
                `Error communicating with server '${serverName}': ${e.message}`,
            );
        }
        context.process.exit(1);
    }
}

export class CliServerProxyProcessor implements ICliCommandProcessor {
    command: string;
    aliases?: string[];
    description?: string;
    version?: string;
    metadata?: CliProcessorMetadata;
    parameters?: ICliCommandParameterDescriptor[];
    processors?: ICliCommandProcessor[];
    /** Full command path from root to this processor (e.g. ["aws", "lambda", "list"]) */
    private readonly commandPath: string[];

    constructor(
        private readonly connection: CliServerConnection,
        private readonly descriptor: CliServerCommandDescriptor,
        private readonly serverName: string,
        isNested = false,
        parentPath: string[] = [],
    ) {
        this.commandPath = [...parentPath, descriptor.command];
        this.command = isNested
            ? descriptor.command
            : `${serverName}:${descriptor.command}`;
        this.description = descriptor.description;
        this.version = descriptor.version;
        this.metadata = {
            module: `server:${serverName}`,
            icon: '\u{1F5A5}',
            requireServer: true,
        };
        this.parameters = descriptor.parameters?.map((p) => ({
            name: p.name,
            aliases: p.aliases,
            description: p.description,
            required: p.required,
            type: p.type,
            defaultValue: p.defaultValue,
        }));
        this.processors = descriptor.processors?.map(
            (sub) =>
                new CliServerProxyProcessor(connection, sub, serverName, true, this.commandPath),
        );
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        return executeOnServer(
            this.connection,
            this.serverName,
            this.descriptor,
            command,
            context,
            this.commandPath,
        );
    }
}

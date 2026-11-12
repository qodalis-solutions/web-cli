import {
    CliProcessCommand,
    CliProcessorMetadata,
    CliServerCommandDescriptor,
    CliServerOutput,
    CliServerResponse,
    CliServerTablePage,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
    CliForegroundColor,
} from '@qodalis/cli-core';
import { CliServerConnection } from './cli-server-connection';
import {
    serverCommandMetadata,
    serverCommandParameters,
    serverCommandWriteDescription,
} from './cli-server-command-metadata';

/**
 * Render a single CliServerOutput to the terminal.
 */
export function renderSingleOutput(
    output: CliServerOutput,
    context: ICliExecutionContext,
    rawCommand?: string,
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
            if (output.page) writePageFooter(output.page, output.rows.length, context, rawCommand);
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
 * The command line for the next rows: `rawCommand` with its `--skip` replaced
 * (`accounts list --take 20 --skip 20` -> `... --take 20 --skip 40`).
 */
export function nextRowsCommand(rawCommand: string, skip: number): string {
    const withoutSkip = rawCommand.replace(/\s--skip(?:=|\s+)\S+/g, '').trim();
    return `${withoutSkip} --skip ${skip}`;
}

/**
 * The line under a paged server table: `Rows 51–100 of 1987 · next: <cmd> --skip 100`,
 * or, for a table the server cut, how many rows were left out.
 */
function writePageFooter(
    page: CliServerTablePage,
    rowCount: number,
    context: ICliExecutionContext,
    rawCommand?: string,
): void {
    const { writer } = context;
    const t = context.translator;
    if (page.truncated) {
        writer.writeWarning(
            t.t(
                'cli.server.page.truncated',
                'Showing the first {shown} of {total} rows: this command does not page. Narrow it down to see the rest.',
                { shown: String(rowCount), total: String(page.total ?? '?') },
            ),
        );
        return;
    }
    const total = page.total !== undefined ? String(page.total) : undefined;
    const parts = [
        rowCount === 0
            ? total !== undefined
                ? t.t('cli.server.page.none_of', 'No rows after {skip} of {total}', { skip: String(page.skip), total })
                : t.t('cli.server.page.none', 'No rows after {skip}', { skip: String(page.skip) })
            : total !== undefined
              ? t.t('cli.server.page.rows_of', 'Rows {from}–{to} of {total}', {
                    from: String(page.skip + 1),
                    to: String(page.skip + rowCount),
                    total,
                })
              : t.t('cli.server.page.rows', 'Rows {from}–{to}', {
                    from: String(page.skip + 1),
                    to: String(page.skip + rowCount),
                }),
    ];
    if (page.hasMore && rawCommand) {
        parts.push(
            `${t.t('cli.server.page.next', 'next:')} ${writer.wrapInColor(nextRowsCommand(rawCommand, page.skip + rowCount), CliForegroundColor.Cyan)}`,
        );
    }
    writer.writeln(`\x1b[2m${parts.join(' · ')}\x1b[0m`);
}

/**
 * Render a CliServerResponse to the terminal.
 */
export function renderServerResponse(
    response: CliServerResponse,
    context: ICliExecutionContext,
    rawCommand?: string,
): void {
    for (const output of response.outputs ?? []) {
        renderSingleOutput(output, context, rawCommand);
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
    context.notifier.info(`executing command: ${cmdLabel} on server ${serverName}`);

    try {
        if (connection.capabilities?.streaming) {
            // Streaming mode — render outputs as they arrive
            const result = await connection.executeStream(
                serverCommand,
                (output) => renderSingleOutput(output, context, command.rawCommand),
            );
            if (result.exitCode !== 0) {
                context.process.exit(result.exitCode);
            }
        } else {
            // Legacy mode — wait for full response
            context.spinner?.show('Executing on server...');
            const response = await connection.execute(serverCommand);
            context.spinner?.hide();
            renderServerResponse(response, context, command.rawCommand);
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
    acceptsRawInput?: boolean;
    writeDescription?: (context: ICliExecutionContext) => void;
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
        // Server aliases: as they are on sub-commands, namespaced (`node:b64`) on the root
        const aliases = descriptor.aliases?.filter(Boolean) ?? [];
        if (aliases.length) {
            this.aliases = isNested ? [...aliases] : aliases.map((a) => `${serverName}:${a}`);
        }
        this.metadata = serverCommandMetadata(descriptor, `server:${serverName}`, serverName);
        this.parameters = serverCommandParameters(descriptor);
        this.writeDescription = serverCommandWriteDescription(descriptor);
        this.processors = descriptor.processors?.map(
            (sub) =>
                new CliServerProxyProcessor(connection, sub, serverName, true, this.commandPath),
        );
        // The server receives the value (`node:hello world`); commands with
        // sub-commands resolve the next word as a sub-command instead
        this.acceptsRawInput = !this.processors?.length;
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

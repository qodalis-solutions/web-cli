import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandChildProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IScpTransferService, IScpTransferService_TOKEN } from '../interfaces';
import { resolveServer, serverUrl, formatBytes, parseServerAndPath } from './scp-utils';

export class CliScpLsProcessor implements ICliCommandChildProcessor {
    command = 'ls';
    description = 'List files and directories on a remote server';
    acceptsRawInput = true;
    valueRequired = true;
    parent?: ICliCommandProcessor;

    parameters = [
        {
            name: 'server',
            description: 'Server name',
            required: true,
            type: 'string' as const,
        },
        {
            name: 'path',
            description: 'Remote directory path',
            required: true,
            type: 'string' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const parsed = parseServerAndPath(command.value, context, command.args);
        if (!parsed) {
            context.writer.writeError('Usage: scp ls <server> <path>');
            return;
        }

        const [serverName, path] = parsed;
        const server = resolveServer(serverName, context);
        if (!server) return;

        const transferService = context.services.getRequired<IScpTransferService>(
            IScpTransferService_TOKEN,
        );

        if (!transferService) {
            context.writer.writeError('SCP transfer service not available.');
            return;
        }

        context.spinner?.show(`Listing ${path} on ${server.name}...`);

        try {
            const entries = await transferService.ls(
                serverUrl(server),
                path,
                server.headers,
            );
            context.spinner?.hide();

            if (entries.length === 0) {
                context.writer.writeInfo(`Directory is empty: ${path}`);
                return;
            }

            const headers = ['Name', 'Type', 'Size', 'Modified'];
            const rows = entries.map(entry => [
                entry.name,
                entry.type,
                entry.type === 'file' ? formatBytes(entry.size) : '-',
                entry.modified || '-',
            ]);

            context.writer.writeTable(headers, rows);
            context.writer.writeInfo(`${entries.length} item(s)`);
        } catch (err: any) {
            context.spinner?.hide();
            context.writer.writeError(err.message || 'Failed to list directory');
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln('List files and directories on a remote server.');
    }
}

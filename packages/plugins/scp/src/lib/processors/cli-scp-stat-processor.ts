import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandChildProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IScpTransferService, IScpTransferService_TOKEN } from '../interfaces';
import { resolveServer, serverUrl, formatBytes, parseServerAndPath } from './scp-utils';

export class CliScpStatProcessor implements ICliCommandChildProcessor {
    command = 'stat';
    description = 'Show file or directory information on a remote server';
    acceptsRawInput = true;
    valueRequired = false;
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
            description: 'Remote file or directory path',
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
            context.writer.writeError('Usage: scp stat <server> <path>');
            return;
        }

        const [serverName, path] = parsed;
        const server = resolveServer(serverName, context);
        if (!server) return;

        const transferService = context.services.get<IScpTransferService>(
            IScpTransferService_TOKEN,
        );

        if (!transferService) {
            context.writer.writeError('SCP transfer service not available.');
            return;
        }

        context.spinner?.show(`Getting info for ${path} on ${server.name}...`);

        try {
            const stat = await transferService.stat(
                serverUrl(server),
                path,
                server.headers,
            );
            context.spinner?.hide();

            const entries: Record<string, string> = {
                Name: stat.name,
                Type: stat.type,
                Size: formatBytes(stat.size),
                Modified: stat.modified || '-',
                Created: stat.created || '-',
            };

            if (stat.permissions) {
                entries['Permissions'] = stat.permissions;
            }

            context.writer.writeKeyValue(entries);
        } catch (err: any) {
            context.spinner?.hide();
            context.writer.writeError(err.message || 'Failed to get file info');
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln('Show file or directory information on a remote server.');
    }
}

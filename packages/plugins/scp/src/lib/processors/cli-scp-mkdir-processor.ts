import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandChildProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IScpTransferService, IScpTransferService_TOKEN } from '../interfaces';
import { resolveServer, serverUrl, parseServerAndPath } from './scp-utils';

export class CliScpMkdirProcessor implements ICliCommandChildProcessor {
    command = 'mkdir';
    description = 'Create a directory on a remote server';
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
            description: 'Remote directory path to create',
            required: true,
            type: 'string' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const parsed = parseServerAndPath(command.value, context);
        if (!parsed) {
            context.writer.writeError('Usage: scp mkdir <server> <path>');
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

        context.spinner?.show(`Creating directory ${path} on ${server.name}...`);

        try {
            await transferService.mkdir(
                serverUrl(server),
                path,
                server.headers,
            );
            context.spinner?.hide();

            context.writer.writeSuccess(`Created directory: ${server.name}:${path}`);
        } catch (err: any) {
            context.spinner?.hide();
            context.writer.writeError(err.message || 'Failed to create directory');
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln('Create a directory on a remote server.');
    }
}

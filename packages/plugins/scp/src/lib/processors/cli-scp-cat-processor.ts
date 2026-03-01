import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandChildProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IScpTransferService, IScpTransferService_TOKEN } from '../interfaces';
import { resolveServer, serverUrl, parseServerAndPath } from './scp-utils';

export class CliScpCatProcessor implements ICliCommandChildProcessor {
    command = 'cat';
    description = 'Display contents of a remote file';
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
            description: 'Remote file path',
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
            context.writer.writeError('Usage: scp cat <server> <path>');
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

        context.spinner?.show(`Reading ${path} on ${server.name}...`);

        try {
            const content = await transferService.cat(
                serverUrl(server),
                path,
                server.headers,
            );
            context.spinner?.hide();

            context.writer.writeln(content);
        } catch (err: any) {
            context.spinner?.hide();
            context.writer.writeError(err.message || 'Failed to read file');
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln('Display the contents of a remote file.');
    }
}

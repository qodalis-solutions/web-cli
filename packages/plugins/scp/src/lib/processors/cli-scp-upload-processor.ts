import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandChildProcessor,
    ICliExecutionContext,
    ICliFileTransferService,
    ICliFileTransferService_TOKEN,
} from '@qodalis/cli-core';
import { IScpTransferService, IScpTransferService_TOKEN } from '../interfaces';
import { resolveServer, serverUrl, formatBytes } from './scp-utils';

export class CliScpUploadProcessor implements ICliCommandChildProcessor {
    command = 'upload';
    aliases = ['put'];
    description = 'Upload a local file to a remote server';
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
            name: 'local-path',
            description: 'Local file path',
            required: true,
            type: 'string' as const,
        },
        {
            name: 'remote-path',
            description: 'Remote destination path',
            required: true,
            type: 'string' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const args = command.args || {};
        let serverName: string | undefined;
        let localPath: string | undefined;
        let remotePath: string | undefined;

        // Try named args first
        if (args['server'] && args['local-path'] && args['remote-path']) {
            serverName = String(args['server']);
            localPath = String(args['local-path']);
            remotePath = String(args['remote-path']);
        } else {
            // Fall back to positional
            const value = command.value?.trim();
            if (!value) {
                context.writer.writeError('Usage: scp upload <server> <local-path> <remote-path>');
                return;
            }
            const parts = value.split(/\s+/);
            if (parts.length < 3) {
                context.writer.writeError('Usage: scp upload <server> <local-path> <remote-path>');
                return;
            }
            serverName = parts[0];
            localPath = parts[1];
            remotePath = parts[2];
        }

        if (!serverName || !localPath || !remotePath) {
            context.writer.writeError('Usage: scp upload <server> <local-path> <remote-path>');
            return;
        }

        const server = resolveServer(serverName, context);
        if (!server) return;

        const fileService = context.services.get<ICliFileTransferService>(
            ICliFileTransferService_TOKEN,
        );

        if (!fileService) {
            context.writer.writeError('File transfer service not available.');
            return;
        }

        const transferService = context.services.get<IScpTransferService>(
            IScpTransferService_TOKEN,
        );

        if (!transferService) {
            context.writer.writeError('SCP transfer service not available.');
            return;
        }

        context.spinner?.show(`Reading local file "${localPath}"...`);

        try {
            const content = await fileService.readFile(localPath);
            if (content === null) {
                context.spinner?.hide();
                context.writer.writeError(`Local file not found: ${localPath}`);
                return;
            }

            const filename = localPath.split('/').pop() || 'file';
            context.spinner?.show(
                `Uploading "${filename}" (${formatBytes(content.length)}) to ${server.name}:${remotePath}...`,
            );

            await transferService.upload(
                serverUrl(server),
                remotePath,
                content,
                filename,
                server.headers,
            );
            context.spinner?.hide();

            context.writer.writeSuccess(
                `Uploaded "${filename}" (${formatBytes(content.length)}) to ${server.name}:${remotePath}`,
            );
        } catch (err: any) {
            context.spinner?.hide();
            context.writer.writeError(err.message || 'Upload failed');
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln('Upload a local file to a remote server.');
        context.writer.writeln('Usage: scp upload <server> <local-path> <remote-path>');
    }
}

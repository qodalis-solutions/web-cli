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
    description = 'Upload a file to a remote server (use --local to pick from your machine)';
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
            description: 'Local file path (from virtual filesystem)',
            required: false,
            type: 'string' as const,
        },
        {
            name: 'remote-path',
            description: 'Remote destination path',
            required: true,
            type: 'string' as const,
        },
        {
            name: 'local',
            description: 'Pick a file from your local machine via browser file picker',
            required: false,
            type: 'boolean' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const args = command.args || {};
        const useLocalPicker = !!args['local'];
        let serverName: string | undefined;
        let localPath: string | undefined;
        let remotePath: string | undefined;

        // Try named args first
        if (args['server'] && args['remote-path']) {
            serverName = String(args['server']);
            localPath = args['local-path'] ? String(args['local-path']) : undefined;
            remotePath = String(args['remote-path']);
        } else {
            // Fall back to positional
            const value = command.value?.trim();
            if (!value) {
                context.writer.writeError(
                    useLocalPicker
                        ? 'Usage: scp upload --local <server> <remote-path>'
                        : 'Usage: scp upload <server> <local-path> <remote-path>',
                );
                return;
            }
            const parts = value.split(/\s+/);
            if (useLocalPicker) {
                if (parts.length < 2) {
                    context.writer.writeError('Usage: scp upload --local <server> <remote-path>');
                    return;
                }
                serverName = parts[0];
                remotePath = parts[1];
            } else {
                if (parts.length < 3) {
                    context.writer.writeError('Usage: scp upload <server> <local-path> <remote-path>');
                    return;
                }
                serverName = parts[0];
                localPath = parts[1];
                remotePath = parts[2];
            }
        }

        if (!serverName || (!useLocalPicker && !localPath) || !remotePath) {
            context.writer.writeError(
                useLocalPicker
                    ? 'Usage: scp upload --local <server> <remote-path>'
                    : 'Usage: scp upload <server> <local-path> <remote-path>',
            );
            return;
        }

        const server = resolveServer(serverName, context);
        if (!server) return;

        const fileService = context.services.getRequired<ICliFileTransferService>(
            ICliFileTransferService_TOKEN,
        );

        if (!fileService) {
            context.writer.writeError('File transfer service not available.');
            return;
        }

        const transferService = context.services.getRequired<IScpTransferService>(
            IScpTransferService_TOKEN,
        );

        if (!transferService) {
            context.writer.writeError('SCP transfer service not available.');
            return;
        }

        let content: string | null;
        let filename: string;

        if (useLocalPicker) {
            const picked = await fileService.uploadFromBrowser();
            if (!picked) {
                context.writer.writeln('Upload cancelled.');
                return;
            }
            content = picked.content;
            filename = picked.name;
        } else {
            context.spinner?.show(`Reading local file "${localPath}"...`);
            content = await fileService.readFile(localPath!);
            if (content === null) {
                context.spinner?.hide();
                context.writer.writeError(`Local file not found: ${localPath}`);
                return;
            }
            filename = localPath!.split('/').pop() || 'file';
        }

        context.spinner?.show(
            `Uploading "${filename}" (${formatBytes(content.length)}) to ${server.name}:${remotePath}...`,
        );
        context.setStatusText(`scp: uploading to ${server.name}`);

        try {
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
        context.writer.writeln('Upload a file to a remote server.');
        context.writer.writeln('');
        context.writer.writeln('Usage:');
        context.writer.writeln('  scp upload <server> <local-path> <remote-path>    Upload from virtual filesystem');
        context.writer.writeln('  scp upload --local <server> <remote-path>         Pick from your machine via browser');
    }
}

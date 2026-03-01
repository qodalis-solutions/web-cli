import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandChildProcessor,
    ICliCommandParameterDescriptor,
    ICliExecutionContext,
    ICliFileTransferService,
    ICliFileTransferService_TOKEN,
} from '@qodalis/cli-core';
import { IScpTransferService, IScpTransferService_TOKEN } from '../interfaces';
import { resolveServer, serverUrl, formatBytes } from './scp-utils';

export class CliScpDownloadProcessor implements ICliCommandChildProcessor {
    command = 'download';
    aliases = ['get'];
    description = 'Download a file from a remote server';
    acceptsRawInput = true;
    valueRequired = true;
    parent?: ICliCommandProcessor;

    parameters: ICliCommandParameterDescriptor[] = [
        {
            name: 'server',
            description: 'Server name',
            required: false,
            type: 'string',
        },
        {
            name: 'remote-path',
            aliases: ['path'],
            description: 'Remote file path',
            required: false,
            type: 'string',
        },
        {
            name: 'local-path',
            description: 'Local destination path',
            required: false,
            type: 'string',
        },
        {
            name: 'save',
            description: 'Save directly to browser downloads instead of virtual filesystem',
            required: false,
            type: 'boolean',
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const args = command.args || {};
        let serverName: string | undefined;
        let remotePath: string | undefined;
        let localPath: string | undefined;

        // Try named args first (--server, --remote-path / --path, --local-path)
        if (args['server'] && (args['remote-path'] || args['path'])) {
            serverName = String(args['server']);
            remotePath = String(args['remote-path'] || args['path']);
            localPath = args['local-path'] ? String(args['local-path']) : undefined;
        } else {
            // Fall back to positional
            const value = command.value?.trim();
            if (!value) {
                context.writer.writeError('Usage: scp download <server> <remote-path> [local-path]');
                return;
            }
            const parts = value.split(/\s+/);
            if (parts.length < 2) {
                context.writer.writeError('Usage: scp download <server> <remote-path> [local-path]');
                return;
            }
            serverName = parts[0];
            remotePath = parts[1];
            localPath = parts[2];
        }

        if (!serverName || !remotePath) {
            context.writer.writeError('Usage: scp download <server> <remote-path> [local-path]');
            return;
        }

        localPath = localPath || remotePath.split('/').pop() || 'download';

        const server = resolveServer(serverName, context);
        if (!server) return;

        const transferService = context.services.get<IScpTransferService>(
            IScpTransferService_TOKEN,
        );

        if (!transferService) {
            context.writer.writeError('SCP transfer service not available.');
            return;
        }

        const useBrowserDownload = command.args?.['save'] === true;

        context.spinner?.show(`Downloading ${remotePath} from ${server.name}...`);

        try {
            const { content, size } = await transferService.download(
                serverUrl(server),
                remotePath,
                server.headers,
                (received, total) => {
                    if (total > 0) {
                        const pct = Math.round((received / total) * 100);
                        context.spinner?.show(
                            `Downloading ${remotePath}... ${pct}% (${formatBytes(received)}/${formatBytes(total)})`,
                        );
                    } else {
                        context.spinner?.show(
                            `Downloading ${remotePath}... ${formatBytes(received)}`,
                        );
                    }
                },
                context.onAbort.asObservable().toPromise() as any,
            );
            context.spinner?.hide();

            if (useBrowserDownload) {
                const fileService = context.services.get<ICliFileTransferService>(
                    ICliFileTransferService_TOKEN,
                );
                if (fileService) {
                    fileService.downloadToBrowser(localPath, content);
                    context.writer.writeSuccess(
                        `Downloaded ${formatBytes(size)} to browser downloads as "${localPath}"`,
                    );
                } else {
                    context.writer.writeError('File transfer service not available for browser download.');
                }
            } else {
                const fileService = context.services.get<ICliFileTransferService>(
                    ICliFileTransferService_TOKEN,
                );
                if (fileService) {
                    await fileService.writeFile(localPath, content);
                    context.writer.writeSuccess(
                        `Downloaded ${formatBytes(size)} to "${localPath}"`,
                    );
                } else {
                    context.writer.writeError('File transfer service not available.');
                }
            }
        } catch (err: any) {
            context.spinner?.hide();
            context.writer.writeError(err.message || 'Download failed');
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln('Download a file from a remote server.');
        context.writer.writeln('Usage: scp download <server> <remote-path> [local-path]');
        context.writer.writeln('  --save  Save directly to browser downloads');
    }
}

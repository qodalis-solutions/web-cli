import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliCommandChildProcessor,
    ICliExecutionContext,
    ICliFileTransferService,
    ICliFileTransferService_TOKEN,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';
import { IScpTransferService, IScpTransferService_TOKEN } from '../interfaces';
import { resolveServer, serverUrl, formatBytes } from './scp-utils';
import { CliScpLsProcessor } from './cli-scp-ls-processor';
import { CliScpCatProcessor } from './cli-scp-cat-processor';
import { CliScpDownloadProcessor } from './cli-scp-download-processor';
import { CliScpUploadProcessor } from './cli-scp-upload-processor';
import { CliScpRmProcessor } from './cli-scp-rm-processor';
import { CliScpMkdirProcessor } from './cli-scp-mkdir-processor';
import { CliScpStatProcessor } from './cli-scp-stat-processor';

export class CliScpCommandCommandProcessor implements ICliCommandProcessor {
    command = 'scp';

    description = 'SCP-like file transfer between browser and remote servers';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    acceptsRawInput = true;

    processors: ICliCommandChildProcessor[] = [
        new CliScpLsProcessor(),
        new CliScpCatProcessor(),
        new CliScpDownloadProcessor(),
        new CliScpUploadProcessor(),
        new CliScpRmProcessor(),
        new CliScpMkdirProcessor(),
        new CliScpStatProcessor(),
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const value = command.value?.trim();

        // Shorthand: scp myserver:/remote/path => download
        if (value && value.includes(':') && !value.startsWith('-')) {
            const colonIdx = value.indexOf(':');
            const spaceBeforeColon = value.lastIndexOf(' ', colonIdx);

            // If no space before colon, first token is "server:path"
            if (spaceBeforeColon === -1) {
                const serverName = value.substring(0, colonIdx);
                const rest = value.substring(colonIdx + 1);
                const parts = rest.trim().split(/\s+/);
                const remotePath = parts[0];
                const localPath = parts[1] || remotePath.split('/').pop() || 'download';

                if (remotePath) {
                    await this.doDownload(serverName, remotePath, localPath, command, context);
                    return;
                }
            }

            // Shorthand upload: scp ./local myserver:/remote
            const parts = value.split(/\s+/);
            if (parts.length >= 2) {
                const secondPart = parts[1];
                if (secondPart.includes(':')) {
                    const localPath = parts[0];
                    const srvColonIdx = secondPart.indexOf(':');
                    const serverName = secondPart.substring(0, srvColonIdx);
                    const remotePath = secondPart.substring(srvColonIdx + 1);

                    if (remotePath) {
                        await this.doUpload(serverName, localPath, remotePath, context);
                        return;
                    }
                }
            }
        }

        // No shorthand matched — show help
        context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln(this.description!);
    }

    private async doDownload(
        serverName: string,
        remotePath: string,
        localPath: string,
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
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
            let lastProgressUpdate = 0;
            const { content, size } = await transferService.download(
                serverUrl(server),
                remotePath,
                server.headers,
                (received, total) => {
                    const now = Date.now();
                    if (now - lastProgressUpdate < 200) return;
                    lastProgressUpdate = now;

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
            );
            context.spinner?.hide();

            const fileService = context.services.get<ICliFileTransferService>(
                ICliFileTransferService_TOKEN,
            );

            if (!fileService) {
                context.writer.writeError('File transfer service not available.');
                return;
            }

            if (useBrowserDownload) {
                fileService.downloadToBrowser(localPath, content);
                context.writer.writeSuccess(
                    `Downloaded ${formatBytes(size)} to browser downloads as "${localPath}"`,
                );
            } else {
                await fileService.writeFile(localPath, content);
                context.writer.writeSuccess(
                    `Downloaded ${formatBytes(size)} to "${localPath}"`,
                );
            }
        } catch (err: any) {
            context.spinner?.hide();
            context.writer.writeError(err.message || 'Download failed');
        }
    }

    private async doUpload(
        serverName: string,
        localPath: string,
        remotePath: string,
        context: ICliExecutionContext,
    ): Promise<void> {
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
}

import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliCommandParameterDescriptor,
    ICliExecutionContext,
    ICliFileTransferService,
    ICliFileTransferService_TOKEN,
    BrowserFileTransferService,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

export class CliWgetCommandCommandProcessor implements ICliCommandProcessor {
    command = 'wget';

    description = 'Download files from any HTTP/HTTPS URL';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    acceptsRawInput = true;

    valueRequired = true;

    metadata = {
        icon: '⬇',
        module: 'file management',
    };

    parameters: ICliCommandParameterDescriptor[] = [
        {
            name: 'output',
            aliases: ['o'],
            type: 'string',
            description: 'Output filename (default: derived from URL)',
            required: false,
        },
        {
            name: 'header',
            aliases: ['H'],
            type: 'array',
            description: 'Custom HTTP header (can be repeated)',
            required: false,
        },
        {
            name: 'no-progress',
            type: 'boolean',
            description: 'Suppress progress bar',
            required: false,
        },
        {
            name: 'save',
            type: 'boolean',
            description: 'Save to browser downloads instead of virtual filesystem',
            required: false,
        },
    ];

    processors: ICliCommandProcessor[] = [];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const url = command.value?.trim();
        if (!url) {
            context.writer.writeError('Usage: wget <url> [-o filename] [--header "Name: Value"]');
            context.process.exit(1);
            return;
        }

        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            context.writer.writeError(`Invalid URL: ${url}`);
            context.process.exit(1);
            return;
        }

        const outputName = command.args['output'] || command.args['o']
            || this._filenameFromUrl(parsedUrl);

        const headers: Record<string, string> = {};
        const rawHeaders = command.args['header'] || command.args['H'];
        if (rawHeaders) {
            const headerList = Array.isArray(rawHeaders) ? rawHeaders : [rawHeaders];
            for (const h of headerList) {
                const colonIdx = h.indexOf(':');
                if (colonIdx > 0) {
                    headers[h.slice(0, colonIdx).trim()] = h.slice(colonIdx + 1).trim();
                }
            }
        }

        const showProgress = !command.args['no-progress'];
        const saveToBrowser = !!command.args['save'];

        const fileTransfer = this._getFileTransferService(context);

        try {
            if (showProgress) {
                context.spinner?.show(`Connecting to ${parsedUrl.hostname}...`);
            }
            context.notifier.info(`Connecting to ${parsedUrl.hostname}`);

            const response = await context.http.fetch(url, {
                headers,
            });

            if (!response.ok) {
                context.spinner?.hide();
                context.writer.writeError(`HTTP ${response.status}: ${response.statusText}`);
                context.process.exit(1);
                return;
            }

            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
            const contentType = response.headers.get('content-type') || '';

            context.spinner?.hide();
            context.notifier.info(`Downloading ${outputName}`);

            if (showProgress && contentLength > 0) {
                context.progressBar.show(`Downloading ${outputName}`);
            } else if (showProgress) {
                context.spinner?.show(`Downloading ${outputName}...`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                const text = await response.text();
                if (saveToBrowser) {
                    fileTransfer.downloadToBrowser(outputName, text);
                } else {
                    await fileTransfer.writeFile(outputName, text);
                }
                context.spinner?.hide();
                context.writer.writeSuccess(`Saved: ${outputName}`);
                return;
            }

            const chunks: Uint8Array[] = [];
            let receivedBytes = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                receivedBytes += value.length;

                if (showProgress && contentLength > 0) {
                    const progress = receivedBytes / contentLength;
                    context.progressBar.update(progress);
                    context.progressBar.setText(
                        `${outputName} (${this._formatBytes(receivedBytes)}/${this._formatBytes(contentLength)})`,
                    );
                    context.notifier.info(`Downloading ${outputName}: ${Math.round(progress * 100)}%`);
                } else if (showProgress) {
                    context.spinner?.setText(`Downloading ${outputName}... ${this._formatBytes(receivedBytes)}`);
                    context.notifier.info(`Downloading ${outputName}: ${this._formatBytes(receivedBytes)}`);
                }
            }

            const combined = new Uint8Array(receivedBytes);
            let offset = 0;
            for (const chunk of chunks) {
                combined.set(chunk, offset);
                offset += chunk.length;
            }

            if (showProgress && contentLength > 0) {
                context.progressBar.complete();
                context.progressBar.hide();
            } else {
                context.spinner?.hide();
            }

            const isText = contentType.includes('text') || contentType.includes('json') || contentType.includes('xml');

            if (saveToBrowser) {
                const blob = new Blob([combined]);
                fileTransfer.downloadToBrowser(outputName, blob);
            } else if (isText) {
                const text = new TextDecoder().decode(combined);
                await fileTransfer.writeFile(outputName, text);
            } else {
                // Binary file — encode as base64 and save to virtual filesystem
                const base64 = this._uint8ArrayToBase64(combined);
                const dataUri = `data:${contentType || 'application/octet-stream'};base64,${base64}`;
                await fileTransfer.writeFile(outputName, dataUri);
            }

            context.writer.writeSuccess(`Downloaded: ${outputName} (${this._formatBytes(receivedBytes)})`);
        } catch (err: any) {
            context.spinner?.hide();
            context.progressBar.hide();

            if (err.name === 'AbortError') {
                context.writer.writeWarning('Download cancelled.');
            } else {
                context.writer.writeError(`Download failed: ${err.message}`);
            }
            context.process.exit(1);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln(this.description!);
    }

    private _getFileTransferService(context: ICliExecutionContext): ICliFileTransferService {
        try {
            return context.services.getRequired<ICliFileTransferService>(ICliFileTransferService_TOKEN);
        } catch {
            return new BrowserFileTransferService();
        }
    }

    private _filenameFromUrl(url: URL): string {
        const pathname = url.pathname;
        const segments = pathname.split('/').filter(Boolean);
        return segments.length > 0 ? segments[segments.length - 1] : 'download';
    }

    private _uint8ArrayToBase64(bytes: Uint8Array): string {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    private _formatBytes(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
}

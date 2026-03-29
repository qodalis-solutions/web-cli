import {
    CliForegroundColor,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

/**
 * Cloudflare speed test endpoints — edge-served, CORS-enabled, fast worldwide.
 * The `bytes` parameter controls the download size.
 */
const DEFAULT_DOWNLOAD_URL =
    'https://speed.cloudflare.com/__down?bytes=26214400';

const DEFAULT_UPLOAD_URL = 'https://speed.cloudflare.com/__up';

/** Size of upload test payload in bytes (10 MB). */
const UPLOAD_SIZE = 10 * 1024 * 1024;

/** Format bytes/second as a human-readable speed string. */
function formatSpeed(bytesPerSecond: number): string {
    const mbps = (bytesPerSecond * 8) / (1024 * 1024);
    if (mbps >= 1) return `${mbps.toFixed(2)} Mbps`;
    const kbps = (bytesPerSecond * 8) / 1024;
    if (kbps >= 1) return `${kbps.toFixed(1)} Kbps`;
    return `${(bytesPerSecond * 8).toFixed(0)} bps`;
}

/** Format bytes as a human-readable size string. */
function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
}

export class CliSpeedTestCommandProcessor implements ICliCommandProcessor {
    command = 'speed-test';

    description = 'Run an internet speed test';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] = [];

    parameters = [
        {
            name: 'download-url',
            description: 'Custom URL for the download test',
            type: 'string' as const,
            required: false,
        },
        {
            name: 'upload-url',
            description: 'Custom URL for the upload test',
            type: 'string' as const,
            required: false,
        },
        {
            name: 'download-only',
            description: 'Only run the download test',
            type: 'boolean' as const,
            required: false,
        },
        {
            name: 'upload-only',
            description: 'Only run the upload test',
            type: 'boolean' as const,
            required: false,
        },
    ];

    metadata?: CliProcessorMetadata = {
        icon: '🚀',
        requiredCoreVersion: '>=2.0.0 <3.0.0',
        requiredCliVersion: '>=2.0.0 <3.0.0',
    };

    constructor() {
        this.processors = [
            {
                command: 'run',
                description: 'Run the internet speed test',
                processCommand: async (command, context) => {
                    await this.runSpeedTest(command, context);
                },
            },
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        await this.runSpeedTest(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description);
        writer.writeln();
        writer.writeln('Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('speed-test', CliForegroundColor.Cyan)}                                Run download & upload test`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('speed-test --download-only', CliForegroundColor.Cyan)}                Download only`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('speed-test --upload-only', CliForegroundColor.Cyan)}                  Upload only`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('speed-test --download-url=<url>', CliForegroundColor.Cyan)}           Custom download URL`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('speed-test --upload-url=<url>', CliForegroundColor.Cyan)}             Custom upload URL`,
        );
        writer.writeln();
        writer.writeln(
            `Press ${writer.wrapInColor('Ctrl+C', CliForegroundColor.Yellow)} to abort the test`,
        );
    }

    private async runSpeedTest(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const downloadOnly = !!command.args['download-only'];
        const uploadOnly = !!command.args['upload-only'];

        const results: { download?: number; upload?: number } = {};

        try {
            if (!uploadOnly) {
                const downloadUrl =
                    (command.args['download-url'] as string) ||
                    DEFAULT_DOWNLOAD_URL;
                context.setStatusText('Speed test: download');
                results.download = await this.testDownload(
                    downloadUrl,
                    context,
                );
            }

            if (!downloadOnly) {
                const uploadUrl =
                    (command.args['upload-url'] as string) ||
                    DEFAULT_UPLOAD_URL;
                context.setStatusText('Speed test: upload');
                results.upload = await this.testUpload(
                    uploadUrl,
                    context,
                );
            }

            this.printSummary(results, context);
        } catch (error: any) {
            if (error.name === 'AbortError' || context.signal?.aborted) {
                context.writer.writeWarning('Speed test aborted');
            } else {
                context.writer.writeError(
                    `Speed test failed: ${error.message || error}`,
                );
            }
        }
    }

    private async testDownload(
        url: string,
        context: ICliExecutionContext,
    ): Promise<number> {
        context.writer.writeln();

        const progressBar = context.progressBar;
        const spinner = context.spinner;

        // Show spinner while waiting for connection (DNS, TLS, TTFB)
        spinner?.show('Connecting...');

        const response = await context.http.fetch(url);

        if (!response.ok) {
            spinner?.hide();
            throw new Error(`Download failed: HTTP ${response.status}`);
        }

        spinner?.hide();
        context.writer.writeInfo('Running download test...');

        const contentLength = parseInt(
            response.headers.get('content-length') || '0',
            10,
        );

        progressBar.show();
        progressBar.update(0);

        // Start timing AFTER connection is established (exclude TTFB)
        const startTime = performance.now();
        let totalBytes = 0;

        const reader = response.body!.getReader();
        let lastUpdateTime = startTime;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            totalBytes += value.length;

            const now = performance.now();
            if (now - lastUpdateTime > 250) {
                lastUpdateTime = now;
                const elapsedSec = (now - startTime) / 1000;
                const avgSpeed = totalBytes / elapsedSec;

                if (contentLength > 0) {
                    const pct = Math.min(
                        (totalBytes / contentLength) * 100,
                        100,
                    );
                    progressBar.update(pct);
                    progressBar.setText(
                        `${formatSpeed(avgSpeed)} | ${formatBytes(totalBytes)} / ${formatBytes(contentLength)}`,
                    );
                    context.setStatusText(`Download: ${Math.round(pct)}% ${formatSpeed(avgSpeed)}`);
                } else {
                    progressBar.setText(
                        `${formatSpeed(avgSpeed)} | ${formatBytes(totalBytes)}`,
                    );
                    context.setStatusText(`Download: ${formatSpeed(avgSpeed)}`);
                }
            }
        }

        progressBar.complete();
        progressBar.hide();

        const totalSec = (performance.now() - startTime) / 1000;
        const avgSpeed = totalBytes / totalSec;

        context.writer.writeSuccess(
            `Download: ${formatSpeed(avgSpeed)} (${formatBytes(totalBytes)} in ${totalSec.toFixed(1)}s)`,
        );

        return avgSpeed;
    }

    private async testUpload(
        url: string,
        context: ICliExecutionContext,
    ): Promise<number> {
        context.writer.writeln();
        context.writer.writeInfo(
            `Running upload test (${formatBytes(UPLOAD_SIZE)})...`,
        );

        const progressBar = context.progressBar;
        progressBar.show();
        progressBar.update(0);

        // Fill with pseudo-random data to prevent compression from skewing results.
        // crypto.getRandomValues() is limited to 65536 bytes per call.
        const payload = new Uint8Array(UPLOAD_SIZE);
        const chunkSize = 65536;
        for (let offset = 0; offset < UPLOAD_SIZE; offset += chunkSize) {
            const length = Math.min(chunkSize, UPLOAD_SIZE - offset);
            crypto.getRandomValues(new Uint8Array(payload.buffer, offset, length));
        }

        // Use multiple smaller fetch() calls to measure upload speed.
        // A single large POST to Cloudflare's __up may be blocked by CORS
        // when custom headers trigger a preflight. Chunking also lets us
        // report progress without XHR.
        const CHUNK = 1024 * 1024; // 1 MB per request
        const totalChunks = Math.ceil(UPLOAD_SIZE / CHUNK);
        let uploaded = 0;
        const startTime = performance.now();

        for (let i = 0; i < totalChunks; i++) {
            if (context.signal?.aborted) {
                throw new DOMException('Upload aborted', 'AbortError');
            }

            const start = i * CHUNK;
            const end = Math.min(start + CHUNK, UPLOAD_SIZE);
            const chunk = payload.slice(start, end);

            await context.http.fetch(url, {
                method: 'POST',
                body: chunk,
            });

            uploaded += chunk.length;

            const elapsed = (performance.now() - startTime) / 1000;
            const speed = uploaded / elapsed;
            const pct = (uploaded / UPLOAD_SIZE) * 100;
            progressBar.update(pct);
            progressBar.setText(
                `${formatSpeed(speed)} | ${formatBytes(uploaded)} / ${formatBytes(UPLOAD_SIZE)}`,
            );
            context.setStatusText(`Upload: ${Math.round(pct)}% ${formatSpeed(speed)}`);
        }

        const totalSec = (performance.now() - startTime) / 1000;
        const avgSpeed = UPLOAD_SIZE / totalSec;

        progressBar.complete();
        progressBar.hide();

        context.writer.writeSuccess(
            `Upload: ${formatSpeed(avgSpeed)} (${formatBytes(UPLOAD_SIZE)} in ${totalSec.toFixed(1)}s)`,
        );

        return avgSpeed;
    }

    private printSummary(
        results: { download?: number; upload?: number },
        context: ICliExecutionContext,
    ): void {
        context.writer.writeln();

        const headers = ['Test', 'Speed'];
        const rows: string[][] = [];

        if (results.download !== undefined) {
            rows.push(['Download', formatSpeed(results.download)]);
        }
        if (results.upload !== undefined) {
            rows.push(['Upload', formatSpeed(results.upload)]);
        }

        context.writer.writeTable(headers, rows);
        context.process.output(results);
    }
}

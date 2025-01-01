import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import axios, { CancelToken, CancelTokenSource } from 'axios';

export class CliSpeedTestCommandProcessor implements ICliCommandProcessor {
    command = 'speed-test';

    description = 'Run an internet speed test';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] | undefined = [];

    constructor() {
        this.processors = [
            {
                command: 'run',
                description: 'Run the internet speed test',
                parameters: [
                    {
                        name: 'proxy',
                        description: 'Use a proxy server for the test',
                        type: 'boolean',
                        required: false,
                    },
                    {
                        name: 'proxy-url',
                        description: 'URL of the proxy server',
                        type: 'string',
                        required: false,
                        defaultValue: '/proxy',
                    },
                    {
                        name: 'download-url',
                        description: 'URL to download the file',
                        type: 'string',
                        required: false,
                    },
                    {
                        name: 'upload-url',
                        description: 'URL to upload the file',
                        type: 'string',
                        required: false,
                    },
                ],
                processCommand: async (command, context) => {
                    const source: CancelTokenSource =
                        axios.CancelToken.source();

                    const subscription = context.onAbort.subscribe(() => {
                        source.cancel('Speed test aborted by user');

                        subscription.unsubscribe();
                    });

                    new Promise<void>(async (resolve, reject) => {
                        context.writer.writeInfo('Starting live speed test...');

                        const proxyUrl =
                            command.args['proxy-url'] || '/speed-test';

                        const downloadUrl =
                            command.args['download-url'] ||
                            (command.args['proxy']
                                ? proxyUrl
                                : 'https://nbg1-speed.hetzner.com/100MB.bin');

                        const uploadUrl =
                            command.args['upload-url'] ||
                            'https://httpbin.org/post';

                        try {
                            await this.runDownloadSpeedTest(
                                downloadUrl,
                                context,
                                source.token,
                            );

                            await this.runUploadSpeedTest(
                                uploadUrl,
                                context,
                                source,
                            );

                            context.writer.writeInfo('Speed test completed');

                            resolve();
                        } catch (error) {
                            context.writer.writeError(
                                `Speed test failed: ${error?.toString()}`,
                            );

                            reject(error);
                        }

                        subscription.unsubscribe();

                        context.showPrompt();
                    });
                },
            },
        ];
    }

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.writer.writeError("Use 'speed-test' command with a subcommand");
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln(this.description);
        // Examples
        context.writer.writeln('Examples:');
        context.writer.writeln('  speed-test run');
    }

    /**
     * Run the download speed test with live updates.
     * @param context CLI execution context.
     */
    private async runDownloadSpeedTest(
        url: string,
        context: ICliExecutionContext,
        cancelToken: CancelToken,
    ): Promise<void> {
        const startTime = performance.now();
        let previousTime = startTime;
        let previousLoaded = 0;

        await axios.get(url, {
            responseType: 'arraybuffer',
            cancelToken: cancelToken,
            headers: {
                Origin: null,
            },
            onDownloadProgress: (progressEvent) => {
                if (!!cancelToken.reason) {
                    throw new Error('Speed test aborted by user');
                }

                const currentTime = performance.now();
                const elapsedTime = (currentTime - previousTime) / 1000;
                const bytesSinceLastUpdate =
                    progressEvent.loaded - previousLoaded;

                if (elapsedTime > 0) {
                    const speedInBps = bytesSinceLastUpdate / elapsedTime; // Bytes per second
                    const speedInMbps = (speedInBps * 8) / (1024 * 1024); // Convert to Mbps
                    context.writer.writeln(
                        `Download Speed: ${speedInMbps.toFixed(
                            2,
                        )} Mbps (Progress: ${(
                            (progressEvent.loaded / progressEvent.total!) *
                            100
                        ).toFixed(2)}%)`,
                    );
                }

                // Update previous values
                previousTime = currentTime;
                previousLoaded = progressEvent.loaded;
            },
        });

        const endTime = performance.now();
        const totalTime = (endTime - startTime) / 1000;
        context.writer.writeSuccess(
            `Download test completed in ${totalTime.toFixed(2)} seconds`,
        );
    }

    /**
     * Run the upload speed test with live updates.
     * @param context CLI execution context.
     */
    private async runUploadSpeedTest(
        url: string,
        context: ICliExecutionContext,
        source: CancelTokenSource,
    ): Promise<void> {
        const testData = new Uint8Array(20 * 1024 * 1024); // 20 MB of random data
        testData.fill(0);
        const startTime = performance.now();
        let previousTime = startTime;
        let previousUploaded = 0;

        let uploadComplete = false;

        try {
            await axios.post(url, testData, {
                headers: { 'Content-Type': 'application/octet-stream' },
                cancelToken: source.token,
                responseType: 'stream',
                onUploadProgress: (progressEvent) => {
                    if (!!source.token.reason) {
                        throw new Error('Speed test aborted by user');
                    }

                    const currentTime = performance.now();
                    const elapsedTime = (currentTime - previousTime) / 1000; // Time since last update
                    const bytesSinceLastUpdate =
                        progressEvent.loaded - previousUploaded;

                    if (elapsedTime > 0) {
                        const speedInBps = bytesSinceLastUpdate / elapsedTime; // Bytes per second
                        const speedInMbps = (speedInBps * 8) / (1024 * 1024); // Convert to Mbps
                        context.writer.writeln(
                            `Upload Speed: ${speedInMbps.toFixed(
                                2,
                            )} Mbps (Progress: ${(
                                (progressEvent.loaded / progressEvent.total!) *
                                100
                            ).toFixed(2)}%)`,
                        );
                    }

                    // Update previous values
                    previousTime = currentTime;
                    previousUploaded = progressEvent.loaded;

                    if (progressEvent.loaded >= progressEvent.total!) {
                        uploadComplete = true;
                        source.cancel('Upload test completed');
                    }
                },
            });
        } catch (e) {
            if (axios.isCancel(e)) {
                if (!uploadComplete) {
                    context.writer.writeError('Upload test aborted by user');
                } else {
                    const endTime = performance.now();
                    const totalTime = (endTime - startTime) / 1000;
                    context.writer.writeSuccess(
                        `Upload test completed in ${totalTime.toFixed(2)} seconds`,
                    );
                }
            } else {
                throw e;
            }
        }
    }
}

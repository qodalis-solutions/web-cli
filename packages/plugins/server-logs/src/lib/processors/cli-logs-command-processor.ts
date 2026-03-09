import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    highlightTextWithBg,
    ICliCommandAuthor,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

const levels = ['verbose', 'debug', 'information', 'warning', 'error', 'fatal'];

export class CliLogsCommandProcessor implements ICliCommandProcessor {
    command = 'server-logs';

    description?: string | undefined = 'Show live logs';

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        requireServer: true,
        icon: '📜',
        requiredCoreVersion: '>=2.0.0 <3.0.0',
        requiredCliVersion: '>=2.0.0 <3.0.0',
    };

    parameters?: ICliCommandParameterDescriptor[] | undefined = [
        {
            name: 'pattern',
            type: 'string',
            description: 'The regex pattern to search for in the logs',
            required: false,
            validator: (value: string) => {
                const isValid = this.isValidRegex(value);
                return {
                    valid: isValid,
                    message: isValid
                        ? undefined
                        : 'Invalid regex pattern provided',
                };
            },
        },
        {
            name: 'level',
            type: 'string',
            description:
                'The log level to filter by, e.g. ' + levels.join(', '),
            required: false,
            validator: (value: string) => {
                const isValid = levels.includes(value);

                return {
                    valid: isValid,
                    message: isValid
                        ? undefined
                        : 'Invalid log level provided, must be one of: ' +
                          levels.join(', '),
                };
            },
        },
        {
            name: 'server',
            type: 'string',
            description:
                'The server to connect to, e.g. "http://localhost:5000"',
            required: false,
        },
        {
            name: 'file',
            type: 'boolean',
            description: 'Export logs to a file',
            required: false,
        },
    ];

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    constructor() {
        this.processors?.push({
            command: 'live',
            description: this.description,
            parameters: this.parameters,
            processCommand: this.processCommand.bind(this),
            writeDescription: this.writeDescription.bind(this),
        });
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const serverUrl =
            command.args['server'] || context.options?.servers?.[0]?.url;

        if (!serverUrl) {
            context.writer.writeError(
                'No server URL provided. Use --server=<url> or configure a server in the CLI options.',
            );
            return;
        }

        const cleanServerUrl = serverUrl.replace(/\/+$/, '');
        const wsUrl = cleanServerUrl.replace(/^http/, 'ws');

        let fullUrl = `${wsUrl}/ws/v1/cli/logs`;
        if (command.args['level']) {
            fullUrl += `?level=${encodeURIComponent(command.args['level'])}`;
        }

        let patternRegex: RegExp | null = null;
        if (command.args['pattern']) {
            patternRegex = new RegExp(command.args['pattern'], 'g');
        }

        const ws = new WebSocket(fullUrl);
        const logs: string[] = [];

        return new Promise<void>((resolve) => {
            let index = 0;

            ws.onopen = () => {
                context.writer.writeWarning('Connected to live logs');

                if (command.args['level']) {
                    context.writer.writeWarning(
                        `Filtering logs by: level=${command.args['level']}`,
                    );
                }
                if (command.args['pattern']) {
                    context.writer.writeWarning(
                        `Filtering logs by: pattern=${command.args['pattern']}`,
                    );
                }

                context.writer.writeWarning('Press Ctrl+C to stop');
                context.writer.writeln();
            };

            ws.onmessage = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'connected') {
                        return;
                    }

                    if (data.type === 'disconnect') {
                        ws.close();
                        return;
                    }

                    if (data.type === 'log') {
                        const timestamp = data.timestamp || '';
                        const level = (data.level || '').toUpperCase();
                        const category = data.category || '';
                        const message = data.message || '';

                        const logLine = `[${timestamp}] ${level} [${category}] ${message}`;

                        if (patternRegex) {
                            patternRegex.lastIndex = 0;
                            if (!patternRegex.test(logLine)) {
                                return;
                            }
                            patternRegex.lastIndex = 0;
                        }

                        logs.push(logLine);

                        const displayLine = patternRegex
                            ? highlightTextWithBg(logLine, patternRegex)
                            : logLine;

                        context.writer.writeln(
                            `\x1b[33m${++index}\x1b[0m. ${displayLine}`,
                        );
                    }
                } catch {
                    // Ignore non-JSON messages
                }
            };

            ws.onclose = () => {
                if (command.args['file'] && logs.length > 0) {
                    const filename = `logs-${new Date().toISOString()}.txt`;
                    context.writer.writeToFile(filename, logs.join('\n'));
                }

                context.writer.writeWarning('Disconnected from live logs');
                resolve();
            };

            ws.onerror = () => {
                context.writer.writeError(
                    'WebSocket error occurred while connecting to live logs',
                );
            };

            context.onAbort.subscribe(() => {
                ws.close();
            });
        });
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Stream live server logs via WebSocket');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('server-logs', CliForegroundColor.Cyan)}                                     Start streaming`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('server-logs --level=error', CliForegroundColor.Cyan)}                        Filter by level`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('server-logs --pattern="Exception"', CliForegroundColor.Cyan)}                Filter by regex`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('server-logs --server=http://localhost:5000', CliForegroundColor.Cyan)}       Custom server`,
        );
        writer.writeln();
        writer.writeln(`⚙️  Options:`);
        writer.writeln(
            `  ${writer.wrapInColor('--level', CliForegroundColor.Yellow)}      Log level: verbose, debug, information, warning, error, fatal`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--pattern', CliForegroundColor.Yellow)}    Regex pattern to highlight matches`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--server', CliForegroundColor.Yellow)}     Server URL to connect to`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--file', CliForegroundColor.Yellow)}       Export logs to a file on disconnect`,
        );
        writer.writeln();
        writer.writeln(
            `💡 Press ${writer.wrapInColor('Ctrl+C', CliForegroundColor.Yellow)} to stop streaming`,
        );
    }

    private isValidRegex(pattern: string): boolean {
        try {
            new RegExp(pattern);
            return true;
        } catch (e) {
            return false;
        }
    }
}

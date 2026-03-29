import {
    CliHeadersProvider,
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    highlightTextWithBg,
    ICliCommandAuthor,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
    buildAuthenticatedWebSocketUrl,
    resolveServerHeaders,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

const levels = ['verbose', 'debug', 'information', 'warning', 'error', 'fatal'];

/**
 * Extends the built-in `server` command with a `logs` sub-command.
 * The registry merges sub-processors into the existing `server` processor,
 * preserving all original sub-commands (list, status, reconnect, default).
 *
 * Usage: `server logs`, `server logs live`, `server logs --server=node --level=error`
 */
export class CliLogsCommandProcessor implements ICliCommandProcessor {
    command = 'server';

    extendsProcessor = true;

    processors?: ICliCommandProcessor[] | undefined = [
        new ServerLogsSubProcessor(),
    ];

    metadata?: CliProcessorMetadata | undefined = {
        requireServer: true,
        icon: '📜',
        requiredCoreVersion: '>=2.0.0 <3.0.0',
        requiredCliVersion: '>=2.0.0 <3.0.0',
    };

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    async processCommand(
        _command: CliProcessCommand,
        _context: ICliExecutionContext,
    ): Promise<void> {
        // Not called — the registry merges sub-processors into the existing server processor
    }
}

class ServerLogsSubProcessor implements ICliCommandProcessor {
    command = 'logs';

    description?: string | undefined = 'Stream live server logs via WebSocket';

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        icon: '📜',
    };

    parameters?: ICliCommandParameterDescriptor[] | undefined = [
        {
            name: 'pattern',
            type: 'string',
            description: 'The regex pattern to search for in the logs',
            required: false,
            validator: (value: string) => {
                const isValid = isValidRegex(value);
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
                'Server name or URL to connect to, e.g. "node" or "http://localhost:5000"',
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
        const serverArg = command.args['server'] as string | undefined;
        let serverUrl: string | undefined;
        let serverName: string | undefined;
        let serverHeaders: CliHeadersProvider | undefined;

        if (serverArg) {
            if (serverArg.startsWith('http://') || serverArg.startsWith('https://')) {
                serverUrl = serverArg;
                serverName = 'custom';
            } else {
                const match = context.options?.servers?.find(
                    (s) => s.name === serverArg,
                );
                if (match) {
                    serverUrl = match.url;
                    serverName = match.name;
                    serverHeaders = match.headers;
                } else {
                    context.writer.writeError(
                        `Server '${serverArg}' not found. Available servers: ${
                            context.options?.servers?.map((s) => s.name).join(', ') || 'none'
                        }`,
                    );
                    return;
                }
            }
        } else {
            const defaultServer = context.options?.servers?.[0];
            serverUrl = defaultServer?.url;
            serverName = defaultServer?.name;
            serverHeaders = defaultServer?.headers;
        }

        if (!serverUrl) {
            context.writer.writeError(
                'No server URL provided. Use --server=<name|url> or configure a server in the CLI options.',
            );
            return;
        }

        const cleanServerUrl = serverUrl.replace(/\/+$/, '');
        const wsUrl = cleanServerUrl.replace(/^http/, 'ws');

        let fullUrl = `${wsUrl}/ws/v1/qcli/logs`;
        if (command.args['level']) {
            fullUrl += `?level=${encodeURIComponent(command.args['level'])}`;
        }

        let patternRegex: RegExp | null = null;
        if (command.args['pattern']) {
            patternRegex = new RegExp(command.args['pattern'], 'g');
        }

        const ws = new WebSocket(buildAuthenticatedWebSocketUrl(
            fullUrl,
            () => resolveServerHeaders(context.services, serverName ?? 'custom', serverHeaders),
        ));
        const logs: string[] = [];
        context.notifier.info('Connecting to log stream');

        return new Promise<void>((resolve) => {
            let index = 0;

            ws.onopen = () => {
                context.notifier.info('Streaming live logs');
                context.writer.writeSuccess('Streaming live logs...');

                if (command.args['level']) {
                    context.writer.writeInfo(
                        `Level filter: ${command.args['level']}`,
                    );
                }
                if (command.args['pattern']) {
                    context.writer.writeInfo(
                        `Pattern filter: ${command.args['pattern']}`,
                    );
                }

                context.writer.writeInfo('Press Ctrl+C to stop');
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

                context.notifier.info('Log stream disconnected');
                context.writer.writeInfo('Disconnected from live logs');
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
            `  ${writer.wrapInColor('server logs', CliForegroundColor.Cyan)}                                     Start streaming`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('server logs --level=error', CliForegroundColor.Cyan)}                        Filter by level`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('server logs --pattern="Exception"', CliForegroundColor.Cyan)}                Filter by regex`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('server logs --server=node', CliForegroundColor.Cyan)}                        Specific server`,
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
            `  ${writer.wrapInColor('--server', CliForegroundColor.Yellow)}     Server name or URL to connect to`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--file', CliForegroundColor.Yellow)}       Export logs to a file on disconnect`,
        );
        writer.writeln();
        writer.writeln(
            `💡 Press ${writer.wrapInColor('Ctrl+C', CliForegroundColor.Yellow)} to stop streaming`,
        );
    }
}

function isValidRegex(pattern: string): boolean {
    try {
        new RegExp(pattern);
        return true;
    } catch (e) {
        return false;
    }
}

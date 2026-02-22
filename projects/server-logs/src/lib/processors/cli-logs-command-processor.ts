import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
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
    toQueryString,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

const levels = ['verbose', 'debug', 'information', 'warning', 'error', 'fatal'];

@Injectable({
    providedIn: 'root',
})
export class CliLogsCommandProcessor implements ICliCommandProcessor {
    command = 'server-logs';

    description?: string | undefined = 'Show live logs';

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        requireServer: true,
        icon: '📜',
        requiredCoreVersion: '0.0.16',
        requiredCliVersion: '1.0.37',
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
            name: 'hub',
            type: 'string',
            description:
                'The hub to connect to, e.g. "loghub" (default) or "loghub2"',
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

    private hubConnection!: signalR.HubConnection;

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
        let qs = '?';

        const args = this.excludeKeys(command.args, ['server', 'hub', 'file']);

        if (Object.keys(args).length > 0) {
            qs += toQueryString(args);
        }

        const hub = command.args['hub'] || 'loghub';

        let server = command.args['server'] || '';
        server = server.replace(/\/+$/, '');

        const url = `${server}/${hub}${qs}`;

        console.log('Connecting to:', url);

        this.hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(url)
            .build();

        const buffer: string[] = [];

        await this.hubConnection
            .start()
            .then(() => {
                console.log('SignalR connection started');

                context.writer.writeWarning('Connected to live logs');
                if (qs.length) {
                    Object.keys(args).forEach((key) => {
                        context.writer.writeWarning(
                            `Filtering logs by: ${key}=${command.args[key]}`,
                        );
                    });
                }

                let firstLog = true;
                let index = 0;

                this.hubConnection.on('log', (log: string) => {
                    if (firstLog) {
                        context.writer.writeln();
                    }

                    buffer.push(log);

                    context.writer.writeln(
                        `\x1b[33m${++index}\x1b[0m. ` +
                            (command.args['pattern']
                                ? highlightTextWithBg(
                                      log,
                                      new RegExp(command.args['pattern'], 'g'),
                                  )
                                : log),
                    );
                    firstLog = false;
                });

                const subscription = context.onAbort.subscribe(() => {
                    this.hubConnection.stop();
                    context.writer.writeWarning('Disconnected from live logs');

                    if (command.args['file']) {
                        const filename = `logs-${new Date().toISOString()}.txt`;
                        context.writer.writeToFile(filename, buffer.join('\n'));
                    }

                    subscription.unsubscribe();
                });
            })
            .catch((err) => {
                console.error('Error starting SignalR connection:', err);
                context.writer.writeError('Failed to connect to live logs');
                context.writer.writeError(err?.toString());
            });
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Stream live server logs via SignalR');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(`  ${writer.wrapInColor('server-logs', CliForegroundColor.Cyan)}                                     Start streaming`);
        writer.writeln(`  ${writer.wrapInColor('server-logs --level=error', CliForegroundColor.Cyan)}                        Filter by level`);
        writer.writeln(`  ${writer.wrapInColor('server-logs --pattern="Exception"', CliForegroundColor.Cyan)}                Filter by regex`);
        writer.writeln(`  ${writer.wrapInColor('server-logs --server=http://localhost:5000', CliForegroundColor.Cyan)}       Custom server`);
        writer.writeln();
        writer.writeln(`⚙️  Options:`);
        writer.writeln(`  ${writer.wrapInColor('--level', CliForegroundColor.Yellow)}      Log level: verbose, debug, information, warning, error, fatal`);
        writer.writeln(`  ${writer.wrapInColor('--pattern', CliForegroundColor.Yellow)}    Regex pattern to highlight matches`);
        writer.writeln(`  ${writer.wrapInColor('--server', CliForegroundColor.Yellow)}     Server URL to connect to`);
        writer.writeln(`  ${writer.wrapInColor('--hub', CliForegroundColor.Yellow)}        Hub name (default: loghub)`);
        writer.writeln(`  ${writer.wrapInColor('--file', CliForegroundColor.Yellow)}       Export logs to a file on disconnect`);
        writer.writeln();
        writer.writeln(`💡 Press ${writer.wrapInColor('Ctrl+C', CliForegroundColor.Yellow)} to stop streaming`);
    }

    private excludeKeys<T extends Record<string, any>>(
        record: T,
        keysToExclude: string[],
    ): Partial<T> {
        return Object.fromEntries(
            Object.entries(record).filter(
                ([key]) => !keysToExclude.includes(key),
            ),
        ) as Partial<T>;
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

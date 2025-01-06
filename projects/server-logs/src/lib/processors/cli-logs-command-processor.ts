import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import {
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
        context.writer.writeln('Show live logs');
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

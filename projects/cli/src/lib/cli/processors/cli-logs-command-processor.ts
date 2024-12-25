import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliCommandAuthor,
    CliBackgroundColor,
    CliForegroundColor,
} from '../models';

import { highlightTextWithBg, toQueryString } from '../../utils';
import { DefaultLibraryAuthor } from '../../constants';

const levels = ['verbose', 'debug', 'information', 'warning', 'error', 'fatal'];

@Injectable({
    providedIn: 'root',
})
export class CliLogsCommandProcessor implements ICliCommandProcessor {
    command = 'logs';

    description?: string | undefined = 'Show live logs';

    processors?: ICliCommandProcessor[] | undefined = [];

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
    ];

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

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
        if (Object.keys(command.args).length > 0) {
            qs += toQueryString(command.args);
        }

        this.hubConnection = new signalR.HubConnectionBuilder()
            .withUrl('/loghub' + qs)
            .build();

        await this.hubConnection
            .start()
            .then(() => {
                console.log('SignalR connection started');

                context.writer.writeWarning('Connected to live logs');
                if (qs.length) {
                    Object.keys(command.args).forEach((key) => {
                        context.writer.writeWarning(
                            `Filtering logs by: ${key}=${command.args[key]}`,
                        );
                    });
                }

                let firstLog = true;
                let index = 0;

                this.hubConnection.on('log', (log: string) => {
                    if (firstLog) {
                        context.writer.writeln('');
                    }

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

                    subscription.unsubscribe();
                });
            })
            .catch((err) => {
                console.error('Error starting SignalR connection:', err);
                context.writer.writeError('Failed to connect to live logs');
            });
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln('Show live logs');
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

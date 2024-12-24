import { Injectable } from '@angular/core';
import {
    CliProcessCommand,
    ICliCommandAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '../models';
import { CliBaseProcessor } from './cli-base-processor';
import { DefaultLibraryAuthor } from '../../constants';

@Injectable({
    providedIn: 'root',
})
export class CliCookiesCommandProcessor
    extends CliBaseProcessor
    implements ICliCommandProcessor
{
    command = 'cookies';

    description = 'Interact with the cookies';

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] | undefined = [];

    constructor() {
        super();

        this.processors = [
            {
                command: 'list',
                allowPartialCommands: true,
                description: 'List all cookies',
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const cookies = document.cookie.split('; ').reduce(
                        (acc, cookie) => {
                            const [cookieKey, cookieValue] = cookie.split('=');
                            acc[cookieKey] = decodeURIComponent(
                                cookieValue || '',
                            );
                            return acc;
                        },
                        {} as Record<string, string>,
                    );

                    for (const [key, value] of Object.entries(cookies)) {
                        context.writer.writeln(`${key}: ${value}`);
                    }
                },
            },
            {
                command: 'get',
                allowPartialCommands: true,
                description: 'Get the value of a key',
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const [key] = command.command.split(' ').slice(2);

                    const cookies = document.cookie.split('; ').reduce(
                        (acc, cookie) => {
                            const [cookieKey, cookieValue] = cookie.split('=');
                            acc[cookieKey] = decodeURIComponent(
                                cookieValue || '',
                            );
                            return acc;
                        },
                        {} as Record<string, string>,
                    );

                    const value = cookies[key];

                    context.writer.writeln(value || 'null');
                },
            },
            {
                command: 'set',
                allowPartialCommands: true,
                description: 'Set the value of a key',
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const [key, ...value] = command.command.split(' ').slice(2);

                    const expires = new Date();
                    expires.setFullYear(expires.getFullYear() + 1);

                    document.cookie = `${key}=${encodeURIComponent(value.join(' '))};expires=${expires.toUTCString()};path=/`;
                    context.writer.writeSuccess('Cookie set successfully');
                },
            },
            {
                command: 'remove',
                allowPartialCommands: true,
                description: 'Remove a key',
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const [key] = command.command.split(' ').slice(2);

                    document.cookie = `${key}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
                    context.writer.writeSuccess('Cookie removed successfully');
                },
            },
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.writer.writeError('Choose a sub-command');
    }

    writeDescription?(context: ICliExecutionContext): void {
        context.writer.writeln(this.description);
    }
}

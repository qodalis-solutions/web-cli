import { Injectable } from '@angular/core';
import {
    CliProcessCommand,
    ICliCommandAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '../models';

import { DefaultLibraryAuthor } from '../../constants';

@Injectable({
    providedIn: 'root',
})
export class CliCookiesCommandProcessor implements ICliCommandProcessor {
    command = 'cookies';

    description = 'Interact with the cookies';

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] | undefined = [];

    constructor() {
        this.processors = [
            {
                command: 'list',
                allowUnlistedCommands: true,
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
                allowUnlistedCommands: true,
                description: 'Get the value of a key',
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const [key] = command.chainCommands.slice(2);

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
                allowUnlistedCommands: true,
                description: 'Set the value of a key',
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const [key, ...value] = command.chainCommands.slice(2);

                    const expires = new Date();
                    expires.setFullYear(expires.getFullYear() + 1);

                    document.cookie = `${key}=${encodeURIComponent(value.join(' '))};expires=${expires.toUTCString()};path=/`;
                    context.writer.writeSuccess('Cookie set successfully');
                },
            },
            {
                command: 'remove',
                allowUnlistedCommands: true,
                description: 'Remove a key',
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const [key] = command.chainCommands.slice(2);

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

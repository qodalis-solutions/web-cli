import { Injectable } from '@angular/core';
import {
    CliForegroundColor,
    CliProcessCommand,
    ICliCommandAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

@Injectable({
    providedIn: 'root',
})
export class CliCookiesCommandProcessor implements ICliCommandProcessor {
    command = 'cookies';

    description = 'Interact with the cookies';

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] | undefined = [];

    version = LIBRARY_VERSION;

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
                    const [key, ...value] = command.chainCommands.slice(1);

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
                    const [key] = command.chainCommands.slice(1);

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
        await context.executor.showHelp(command, context);
    }

    writeDescription?(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Read, write, and delete browser cookies');
        writer.writeln();
        writer.writeln('📋 Commands:');
        writer.writeln(`  ${writer.wrapInColor('cookies list', CliForegroundColor.Cyan)}                    🍪 List all cookies`);
        writer.writeln(`  ${writer.wrapInColor('cookies get <key>', CliForegroundColor.Cyan)}                Read a cookie value`);
        writer.writeln(`  ${writer.wrapInColor('cookies set <key> <value>', CliForegroundColor.Cyan)}        Write a cookie`);
        writer.writeln(`  ${writer.wrapInColor('cookies remove <key>', CliForegroundColor.Cyan)}             Delete a cookie`);
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(`  cookies set lang en              ${writer.wrapInColor('# Set a cookie', CliForegroundColor.Green)}`);
        writer.writeln(`  cookies get lang                 ${writer.wrapInColor('# Read a cookie', CliForegroundColor.Green)}`);
        writer.writeln(`  cookies list                     ${writer.wrapInColor('# Show all cookies', CliForegroundColor.Green)}`);
    }
}

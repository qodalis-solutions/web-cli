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
export class CliLocalStorageCommandProcessor
    extends CliBaseProcessor
    implements ICliCommandProcessor
{
    command = 'local-storage';

    description = 'Interact with the local storage';

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] | undefined = [];

    constructor() {
        super();

        this.processors = [
            {
                command: 'get',
                allowPartialCommands: true,
                description: 'Get the value of a key',
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const [key] = command.command.split(' ').slice(2);

                    const value = localStorage.getItem(key);
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

                    localStorage.setItem(key, value.join(' '));
                    context.writer.writeSuccess('Value set successfully');
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

                    localStorage.removeItem(key);
                    context.writer.writeSuccess('Key removed successfully');
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
        context.writer.writeln('local-storage get <key>');
        context.writer.writeln('Gets the value of the specified key');

        context.writer.writeln('local-storage set <key> <value>');
        context.writer.writeln('Sets the value of the specified key');

        context.writer.writeln('local-storage remove <key>');
        context.writer.writeln('Removes the specified key');
    }
}

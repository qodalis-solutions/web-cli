import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    ICliCommandAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

export class CliLocalStorageCommandProcessor implements ICliCommandProcessor {
    command = 'local-storage';

    description = 'Interact with the local storage';

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] | undefined = [];

    version = LIBRARY_VERSION;

    metadata?: CliProcessorMetadata | undefined = {
        requiredCoreVersion: '>=2.0.0 <3.0.0',
        requiredCliVersion: '>=2.0.0 <3.0.0',
    };

    constructor() {
        this.processors = [
            {
                command: 'get',
                acceptsRawInput: true,
                description: 'Get the value of a key',
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const [key] = command.chainCommands.slice(1);

                    const value = localStorage.getItem(key);
                    context.writer.writeln(value || 'null');
                },
            },
            {
                command: 'set',
                acceptsRawInput: true,
                description: 'Set the value of a key',
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const [key, ...value] = command.chainCommands.slice(1);

                    localStorage.setItem(key, value.join(' '));
                    context.writer.writeSuccess('Value set successfully');
                },
            },
            {
                command: 'remove',
                acceptsRawInput: true,
                description: 'Remove a key',
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const [key] = command.chainCommands.slice(2);

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
        await context.executor.showHelp(command, context);
    }

    writeDescription?(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(
            'Read, write, and delete keys from the browser local storage',
        );
        writer.writeln();
        writer.writeln('📋 Commands:');
        writer.writeln(
            `  ${writer.wrapInColor('local-storage get <key>', CliForegroundColor.Cyan)}             Read a value`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('local-storage set <key> <value>', CliForegroundColor.Cyan)}     Write a value`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('local-storage remove <key>', CliForegroundColor.Cyan)}          Delete a key`,
        );
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(
            `  local-storage set theme dark          ${writer.wrapInColor('# Store a value', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  local-storage get theme               ${writer.wrapInColor('# Read a value', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  local-storage remove theme            ${writer.wrapInColor('# Delete a key', CliForegroundColor.Green)}`,
        );
    }
}

import { Injectable } from '@angular/core';
import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandParameterDescriptor,
    CliForegroundColor,
} from '@qodalis/cli-core';
import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { hotkeysInfo } from '../constants';
import { CliHotKeysCommandProcessor } from './cli-hot-keys-command-processor';

@Injectable({
    providedIn: 'root',
})
export class CliHelpCommandProcessor implements ICliCommandProcessor {
    command = 'help';

    description = 'Displays help for a command';

    allowUnlistedCommands?: boolean | undefined = true;

    author = DefaultLibraryAuthor;

    sealed = true;

    constructor(
        private readonly hotKeysProcessor: CliHotKeysCommandProcessor,
    ) {}

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const [_, ...commands] = command.command.split(' ');

        const writeSeparator = () => {
            context.writer.writeln(
                '-----------------------------------------------',
            );
        };

        if (commands.length === 0) {
            const commands = context.executor.listCommands();
            context.writer.writeln(
                context.writer.wrapInColor(
                    'Available commands:',
                    CliForegroundColor.Yellow,
                ),
            );
            commands.forEach((command) => {
                const processor = context.executor.findProcessor(command, []);
                context.writer.writeln(
                    `- \x1b[31m${command}\x1b[0m - ${
                        processor?.description || 'Missing description'
                    }`,
                );
            });

            writeSeparator();

            await this.hotKeysProcessor.processCommand(command, context);

            writeSeparator();

            context.writer.writeln(
                '\nType `help <command>` to get more information about a specific command',
            );
        } else {
            const processor = context.executor.findProcessor(
                commands[0],
                commands.slice(1),
            );

            if (processor) {
                context.writer.writeln(
                    `\x1b[33mCommand:\x1b[0m ${context.writer.wrapInColor(
                        processor.command,
                        CliForegroundColor.Blue,
                    )} @${
                        processor.version || '1.0.0'
                    } - ${processor.description}`,
                );

                if (processor.author) {
                    context.writer.writeln(
                        `\x1b[33mAuthor:\x1b[0m ${processor.author.name}<${processor.author.email}>`,
                    );
                }

                if (processor.writeDescription) {
                    processor.writeDescription(context);
                } else if (processor.description) {
                    context.writer.writeln(
                        `${context.writer.wrapInColor('Description:', CliForegroundColor.Yellow)} ${processor.description}`,
                    );
                } else {
                    context.writer.writeln(
                        context.writer.wrapInColor(
                            'No description available',
                            CliForegroundColor.Yellow,
                        ),
                    );
                }

                if (processor.processors?.length) {
                    context.writer.writeln(
                        context.writer.wrapInColor(
                            'Subcommands:',
                            CliForegroundColor.Yellow,
                        ),
                    );

                    processor.processors.forEach((subprocessor) => {
                        context.writer.writeln(
                            `- ${context.writer.wrapInColor(
                                subprocessor.command,
                                CliForegroundColor.Blue,
                            )} - ${subprocessor.description}`,
                        );
                    });
                }

                const defaultParameters: ICliCommandParameterDescriptor[] = [
                    {
                        name: 'version',
                        aliases: ['v'],
                        type: 'boolean',
                        description: 'Displays the version of the command',
                        required: false,
                    },
                ];

                const parameters = [
                    ...(processor.parameters || []),
                    ...defaultParameters,
                ];

                context.writer.writeln(
                    context.writer.wrapInColor(
                        'Parameters:',
                        CliForegroundColor.Yellow,
                    ),
                );

                parameters.forEach((parameter) => {
                    context.writer.writeln(
                        `--${context.writer.wrapInColor(
                            parameter.name,
                            CliForegroundColor.Blue,
                        )} (${parameter.type}) ${
                            parameter.aliases
                                ? `(${parameter.aliases.join(', ')})`
                                : ''
                        } - ${parameter.description}${
                            parameter.required ? ' (required)' : ''
                        }`,
                    );
                });
            } else {
                context.writer.writeln(
                    `\x1b[33mUnknown command: ${commands[0]}`,
                );
            }
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln('Displays help for a command');

        context.writer.writeln(
            'If no command is specified, it will display a list of available commands',
        );

        context.writer.writeln(
            'If a command is specified, it will display information about that command',
        );

        context.writer.writeln(
            'If a command is specified with a subcommand, it will display information about that subcommand',
        );
    }
}

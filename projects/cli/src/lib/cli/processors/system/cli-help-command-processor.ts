import { Injectable } from '@angular/core';
import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandParameterDescriptor,
    CliForegroundColor,
    CliProcessorMetadata,
} from '@qodalis/cli-core';
import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { CliHotKeysCommandProcessor } from './cli-hot-keys-command-processor';

@Injectable({
    providedIn: 'root',
})
export class CliHelpCommandProcessor implements ICliCommandProcessor {
    command = 'help';

    description = 'Displays help for a command';

    allowUnlistedCommands?: boolean | undefined = true;

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
    };

    constructor(
        private readonly hotKeysProcessor: CliHotKeysCommandProcessor,
    ) {}

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer, executor } = context;

        const [_, ...commands] = command.command.split(' ');

        const writeSeparator = () => {
            writer.writeln('-----------------------------------------------');
        };

        if (commands.length === 0) {
            const commands = executor.listCommands();
            writer.writeln(
                writer.wrapInColor(
                    'Available commands:',
                    CliForegroundColor.Yellow,
                ),
            );
            commands.forEach((command) => {
                const processor = executor.findProcessor(command, []);
                writer.writeln(
                    `- \x1b[31m${command}\x1b[0m - ${
                        processor?.description || 'Missing description'
                    }`,
                );
            });

            writeSeparator();

            await this.hotKeysProcessor.processCommand(command, context);

            writeSeparator();

            writer.writeln(
                '\nType `help <command>` to get more information about a specific command',
            );
        } else {
            const processor = executor.findProcessor(
                commands[0],
                commands.slice(1),
            );

            if (processor) {
                writer.writeln(
                    `\x1b[33mCommand:\x1b[0m ${writer.wrapInColor(
                        processor.command,
                        CliForegroundColor.Blue,
                    )} @${
                        processor.version || '1.0.0'
                    } - ${processor.description}`,
                );

                writeSeparator();

                if (processor.author) {
                    writer.writeln(
                        `\x1b[33mAuthor:\x1b[0m ${processor.author.name}<${processor.author.email}>`,
                    );

                    writeSeparator();
                }

                writer.write(
                    writer.wrapInColor(
                        'Description: ',
                        CliForegroundColor.Yellow,
                    ),
                );

                if (processor.writeDescription) {
                    processor.writeDescription(context);
                } else if (processor.description) {
                    writer.writeln(
                        `${writer.wrapInColor('Description:', CliForegroundColor.Yellow)} ${processor.description}`,
                    );
                } else {
                    writer.writeln(
                        writer.wrapInColor(
                            'No description available',
                            CliForegroundColor.Yellow,
                        ),
                    );
                }

                writeSeparator();

                if (processor.processors?.length) {
                    writer.writeln(
                        writer.wrapInColor(
                            'Subcommands:',
                            CliForegroundColor.Yellow,
                        ),
                    );

                    processor.processors.forEach((subprocessor) => {
                        writer.writeln(
                            `- ${writer.wrapInColor(
                                subprocessor.command,
                                CliForegroundColor.Blue,
                            )} - ${subprocessor.description}`,
                        );
                    });

                    writeSeparator();
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

                writer.writeln(
                    writer.wrapInColor(
                        'Parameters:',
                        CliForegroundColor.Yellow,
                    ),
                );

                parameters.forEach((parameter) => {
                    writer.writeln(
                        `--${writer.wrapInColor(
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

                writeSeparator();

                if (processor.metadata?.requireServer) {
                    writer.writeln(
                        writer.wrapInColor(
                            'Requires server to be running',
                            CliForegroundColor.Red,
                        ),
                    );
                }
            } else {
                writer.writeln(`\x1b[33mUnknown command: ${commands[0]}`);
            }
        }
    }

    writeDescription({ writer }: ICliExecutionContext): void {
        writer.writeln('Displays help for a command');

        writer.writeln(
            'If no command is specified, it will display a list of available commands',
        );

        writer.writeln(
            'If a command is specified, it will display information about that command',
        );

        writer.writeln(
            'If a command is specified with a subcommand, it will display information about that subcommand',
        );
    }
}

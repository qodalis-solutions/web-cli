import { Injectable, Injector } from '@angular/core';
import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandParameterDescriptor,
    CliForegroundColor,
    CliProcessorMetadata,
    CliIcon,
} from '@qodalis/cli-core';
import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { CliHotKeysCommandProcessor } from './cli-hot-keys-command-processor';
import { CliCommandProcessorRegistry } from '../../services/cli-command-processor-registry';

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
        icon: CliIcon.Help,
    };

    constructor(private readonly injector: Injector) {}

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer } = context;

        const [_, ...commandsToHelp] = command.command.split(' ');

        const registry = this.injector.get(CliCommandProcessorRegistry);

        if (commandsToHelp.length === 0) {
            await context.executor.executeCommand('version', context);

            this.writeSeparator(context);

            const rootCommands = registry.processors.map((p) => p.command);

            writer.writeln(
                writer.wrapInColor(
                    'Available commands:',
                    CliForegroundColor.Yellow,
                ),
            );
            rootCommands.forEach((command) => {
                const processor = registry.findProcessor(command, []);
                writer.writeln(
                    `- ${processor?.metadata?.icon ? processor.metadata.icon : CliIcon.Extension}  ${writer.wrapInColor(command, CliForegroundColor.Cyan)} - ${
                        processor?.description || 'Missing description'
                    }`,
                );
            });

            context.writer.writeln();

            this.writeSeparator(context);

            await context.executor.executeCommand('hotkeys', context);

            this.writeSeparator(context);

            writer.writeln(
                '\nType `help <command>` to get more information about a specific command',
            );
        } else {
            const processor = registry.findProcessor(
                commandsToHelp[0],
                commandsToHelp.slice(1),
            );

            if (processor) {
                this.writeProcessorDescription(processor, context);
            } else {
                writer.writeln(`\x1b[33mUnknown command: ${commandsToHelp[0]}`);
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

    private writeProcessorDescription(
        processor: ICliCommandProcessor,
        context: ICliExecutionContext,
    ) {
        const { writer } = context;

        writer.write('\x1b[33mCommand: \x1b[0m');

        if (processor.metadata?.icon) {
            writer.write(`${processor.metadata.icon}  `);
        }

        writer.writeln(
            `${writer.wrapInColor(
                processor.command,
                CliForegroundColor.Cyan,
            )} @${processor.version || '1.0.0'} - ${processor.description}`,
        );

        this.writeSeparator(context);

        if (processor.author) {
            writer.writeln(
                `\x1b[33mAuthor:\x1b[0m ${processor.author.name}<${processor.author.email}>`,
            );

            this.writeSeparator(context);
        }

        writer.write(
            writer.wrapInColor('Description: ', CliForegroundColor.Yellow),
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

        this.writeSeparator(context);

        if (processor.processors?.length) {
            writer.writeln(
                writer.wrapInColor('Subcommands:', CliForegroundColor.Yellow),
            );

            processor.processors.forEach((subprocessor) => {
                writer.writeln(
                    `- ${writer.wrapInColor(
                        subprocessor.command,
                        CliForegroundColor.Cyan,
                    )} - ${subprocessor.description}`,
                );
            });

            this.writeSeparator(context);
        }

        const parameters = [
            ...(processor.parameters || []),
            ...defaultParameters,
        ];

        writer.writeln(
            writer.wrapInColor('Parameters:', CliForegroundColor.Yellow),
        );

        parameters.forEach((parameter) => {
            writer.writeln(
                `--${writer.wrapInColor(
                    parameter.name,
                    CliForegroundColor.Cyan,
                )} (${parameter.type}) ${
                    parameter.aliases ? `(${parameter.aliases.join(', ')})` : ''
                } - ${parameter.description}${
                    parameter.required ? ' (required)' : ''
                }`,
            );
        });

        this.writeSeparator(context);

        if (processor.metadata?.requireServer) {
            writer.writeln(
                writer.wrapInColor(
                    'Requires server to be running',
                    CliForegroundColor.Red,
                ),
            );
        }
    }

    private writeSeparator({ writer }: ICliExecutionContext) {
        writer.writeDivider({
            char: '=',
        });
    }
}

const defaultParameters: ICliCommandParameterDescriptor[] = [
    {
        name: 'version',
        aliases: ['v'],
        type: 'boolean',
        description: 'Displays the version of the command',
        required: false,
    },
    {
        name: 'main',
        type: 'boolean',
        description: 'Set the command as the main command',
        required: false,
    },
];

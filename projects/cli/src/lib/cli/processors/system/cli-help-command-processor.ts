import { Injectable, Injector } from '@angular/core';
import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandParameterDescriptor,
    CliForegroundColor,
    CliProcessorMetadata,
    CliIcon,
    ICliCommandProcessorRegistry,
} from '@qodalis/cli-core';
import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { CliProcessorsRegistry_TOKEN } from '../../tokens';
import { groupBy } from '../../../utils/arrays';

@Injectable({
    providedIn: 'root',
})
export class CliHelpCommandProcessor implements ICliCommandProcessor {
    command = 'help';

    aliases = ['man'];

    description = 'Displays help for a command';

    allowUnlistedCommands?: boolean | undefined = true;

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        icon: CliIcon.Help,
        module: 'system',
    };

    private readonly registry: ICliCommandProcessorRegistry;

    constructor(private readonly injector: Injector) {
        this.registry = this.injector.get<ICliCommandProcessorRegistry>(
            CliProcessorsRegistry_TOKEN,
        );
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer } = context;

        const [_, ...commandsToHelp] = command.command.split(' ');

        if (commandsToHelp.length === 0) {
            await context.executor.executeCommand('version', context);

            this.writeSeparator(context);

            writer.writeln(
                writer.wrapInColor(
                    '📚 Available commands:',
                    CliForegroundColor.Yellow,
                ),
            );
            writer.writeln();

            const groupedCommands = groupBy<ICliCommandProcessor, string>(
                this.registry.processors,
                (x) => x.metadata?.module || 'uncategorized',
            );

            groupedCommands.forEach((processors, module) => {
                writer.writeln(
                    `📂 ${writer.wrapInColor(module.charAt(0).toUpperCase() + module.slice(1), CliForegroundColor.Yellow)}`,
                );

                processors.forEach((processor) => {
                    const aliasText = processor.aliases?.length
                        ? ` ${writer.wrapInColor(`(${processor.aliases.join(', ')})`, CliForegroundColor.Magenta)}`
                        : '';
                    writer.writeln(
                        `  ${processor?.metadata?.icon ? processor.metadata.icon : CliIcon.Extension}  ${writer.wrapInColor(processor.command, CliForegroundColor.Cyan)}${aliasText} - ${
                            processor?.description || 'Missing description'
                        }`,
                    );
                });

                writer.writeln();
            });

            this.writeSeparator(context);

            await context.executor.executeCommand('hotkeys', context);

            this.writeSeparator(context);

            writer.writeln(
                `\n💡 Type ${writer.wrapInColor('help <command>', CliForegroundColor.Cyan)} to get more information about a specific command`,
            );
        } else {
            const processor = this.registry.findProcessor(
                commandsToHelp[0],
                commandsToHelp.slice(1),
            );

            if (processor) {
                this.writeProcessorDescription(processor, context);
            } else {
                writer.writeError(`Unknown command: ${commandsToHelp[0]}`);
                writer.writeln();
                writer.writeln(`💡 Type ${writer.wrapInColor('help', CliForegroundColor.Cyan)} to see all available commands`);
            }
        }
    }

    writeDescription({ writer }: ICliExecutionContext): void {
        writer.writeln('Displays help information for commands');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(`  ${writer.wrapInColor('help', CliForegroundColor.Cyan)}                    Show all available commands`);
        writer.writeln(`  ${writer.wrapInColor('help <command>', CliForegroundColor.Cyan)}            Show details for a command`);
        writer.writeln(`  ${writer.wrapInColor('help <command> <sub>', CliForegroundColor.Cyan)}      Show details for a subcommand`);
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(`  help pkg                         ${writer.wrapInColor('# Package manager help', CliForegroundColor.Green)}`);
        writer.writeln(`  help theme apply                 ${writer.wrapInColor('# Theme apply subcommand help', CliForegroundColor.Green)}`);
    }

    private writeProcessorDescription(
        processor: ICliCommandProcessor,
        context: ICliExecutionContext,
    ) {
        const { writer } = context;

        // Header
        writer.write(
            writer.wrapInColor('⌘  Command: ', CliForegroundColor.Yellow),
        );

        if (processor.metadata?.icon) {
            writer.write(`${processor.metadata.icon}  `);
        }

        writer.writeln(
            `${writer.wrapInColor(
                processor.command,
                CliForegroundColor.Cyan,
            )} ${writer.wrapInColor(`v${processor.version || '1.0.0'}`, CliForegroundColor.Green)}`,
        );

        writer.writeln(`   ${processor.description}`);

        if (processor.aliases?.length) {
            writer.writeln(
                `   ${writer.wrapInColor('Aliases:', CliForegroundColor.Yellow)} ${processor.aliases.map((a: string) => writer.wrapInColor(a, CliForegroundColor.Magenta)).join(', ')}`,
            );
        }

        this.writeSeparator(context);

        // Author
        if (processor.author) {
            writer.writeln(
                `👤 ${writer.wrapInColor('Author:', CliForegroundColor.Yellow)} ${processor.author.name} <${processor.author.email}>`,
            );

            this.writeSeparator(context);
        }

        // Description
        if (processor.writeDescription) {
            writer.writeln(
                writer.wrapInColor('📖 Description:', CliForegroundColor.Yellow),
            );
            processor.writeDescription(context);
        } else if (processor.description) {
            writer.writeln(
                `${writer.wrapInColor('📖 Description:', CliForegroundColor.Yellow)} ${processor.description}`,
            );
        }

        this.writeSeparator(context);

        // Subcommands
        if (processor.processors?.length) {
            writer.writeln(
                writer.wrapInColor('🔧 Subcommands:', CliForegroundColor.Yellow),
            );

            processor.processors.forEach((subprocessor) => {
                writer.writeln(
                    `  ${writer.wrapInColor(
                        subprocessor.command,
                        CliForegroundColor.Cyan,
                    )}  ${subprocessor.description}`,
                );
            });

            this.writeSeparator(context);
        }

        // Parameters
        const parameters = [
            ...(processor.parameters || []),
            ...defaultParameters,
        ];

        writer.writeln(
            writer.wrapInColor('⚙️  Parameters:', CliForegroundColor.Yellow),
        );

        parameters.forEach((parameter) => {
            const aliases = parameter.aliases?.length
                ? ` ${writer.wrapInColor(`(-${parameter.aliases.join(', -')})`, CliForegroundColor.Magenta)}`
                : '';
            const required = parameter.required
                ? ` ${writer.wrapInColor('(required)', CliForegroundColor.Red)}`
                : '';
            writer.writeln(
                `  --${writer.wrapInColor(
                    parameter.name,
                    CliForegroundColor.Cyan,
                )}${aliases}  ${writer.wrapInColor(`<${parameter.type}>`, CliForegroundColor.Yellow)} ${parameter.description}${required}`,
            );
        });

        this.writeSeparator(context);

        // Server requirement notice
        if (processor.metadata?.requireServer) {
            writer.writeln(
                `🖥  ${writer.wrapInColor(
                    'Requires server to be running',
                    CliForegroundColor.Red,
                )}`,
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

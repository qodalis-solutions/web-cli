import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliYesCommandProcessor implements ICliCommandProcessor {
    command = 'yes';

    description = 'Output a string repeatedly';

    author = DefaultLibraryAuthor;

    allowUnlistedCommands = true;

    metadata?: CliProcessorMetadata = {
        icon: '✅',
        module: 'misc',
    };

    parameters = [
        {
            name: 'count',
            aliases: ['n'],
            description: 'Number of repetitions (default: 20)',
            type: 'number' as const,
            required: false,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const text = (command.value || 'y') as string;
        const count = Math.min(
            parseInt(command.args['count'] || command.args['n']) || 20,
            1000,
        );

        for (let i = 0; i < count; i++) {
            context.writer.writeln(text);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Output a string repeatedly');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('yes [text] [--count=N]', CliForegroundColor.Cyan)}`,
        );
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(
            `  yes                              ${writer.wrapInColor('# Outputs "y" 20 times', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  yes hello --count=5              ${writer.wrapInColor('# Outputs "hello" 5 times', CliForegroundColor.Green)}`,
        );
    }
}

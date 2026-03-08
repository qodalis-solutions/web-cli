import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliEchoCommandProcessor implements ICliCommandProcessor {
    command = 'echo';

    aliases = ['print'];

    description = 'Prints the specified text';

    acceptsRawInput = true;

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        icon: '📢',
        module: 'misc',
    };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const text = command.value || command.data || '';

        if (typeof text === 'object') {
            context.writer.writeJson(text);
        } else {
            context.writer.writeln(text);
        }

        context.process.output(text);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(t.t('cli.echo.long_description', 'Prints the specified text to the terminal'));
        writer.writeln(t.t('cli.echo.piping_note', 'Supports text and JSON object output via piping'));
        writer.writeln();
        writer.writeln(`📋 ${t.t('cli.common.usage', 'Usage:')}`);
        writer.writeln(
            `  ${writer.wrapInColor('echo <text>', CliForegroundColor.Cyan)}`,
        );
        writer.writeln();
        writer.writeln(`📝 ${t.t('cli.common.examples', 'Examples:')}`);
        writer.writeln(
            `  echo Hello World                 ${writer.wrapInColor('# Print text', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  echo "Hello, World!"             ${writer.wrapInColor('# Print quoted text', CliForegroundColor.Green)}`,
        );
    }
}

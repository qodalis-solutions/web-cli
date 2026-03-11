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
        const raw = command.value || command.data || '';

        if (typeof raw === 'object') {
            context.writer.writeJson(raw);
            context.process.output(raw);
        } else {
            const text = this.interpretEscapes(this.stripQuotes(raw));
            context.writer.writeln(text);
            context.process.output(text);
        }
    }

    /** Remove surrounding quotes from the text. */
    private stripQuotes(text: string): string {
        if (
            (text.startsWith('"') && text.endsWith('"')) ||
            (text.startsWith("'") && text.endsWith("'"))
        ) {
            return text.slice(1, -1);
        }
        return text;
    }

    /** Interpret common escape sequences like a POSIX echo -e. */
    private interpretEscapes(text: string): string {
        return text.replace(/\\([\\nrtv0])/g, (_, ch) => {
            switch (ch) {
                case 'n': return '\n';
                case 't': return '\t';
                case 'r': return '\r';
                case 'v': return '\v';
                case '0': return '\0';
                case '\\': return '\\';
                default: return ch;
            }
        });
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

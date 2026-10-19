import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    joinShellWords,
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
        // Everything typed after the command word, flag-like words included
        // (`echo a --b` prints `a --b`, as a shell's echo does)
        const typed = typedText(command);
        const raw = typed || command.data || '';

        if (typeof raw === 'object') {
            context.writer.writeJson(raw);
            context.process.output(raw);
        } else {
            // Typed text is shell words (`echo "a" "b"` prints `a b`); piped
            // text is printed as it is
            const words = typed ? joinShellWords(raw) : raw;
            const text = this.interpretEscapes(words);
            context.writer.writeln(text);
            context.process.output(text);
        }
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

/**
 * The text after the command word (`echo` / `print`), from the line as typed
 * (variables and wildcards already expanded). Leading `-n`, `-e`, `-E`
 * options of a shell's echo are skipped: escapes are always interpreted.
 */
function typedText(command: CliProcessCommand): string {
    const raw = command.rawCommand ?? '';
    const afterWord = raw.replace(/^\s*\S+\s*/, '');
    const text = afterWord.replace(/^(?:-[neE]+\s+)+/, '').trim();
    return text || (command.value ?? '');
}

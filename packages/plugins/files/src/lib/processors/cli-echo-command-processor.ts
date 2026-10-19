import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    joinShellWords,
    writeExamples,
    writeUsage,
    writeWrapped,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

export class CliEchoCommandProcessor implements ICliCommandProcessor {
    command = 'echo';
    description = 'Display text or redirect output to a file';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    extendsProcessor = true;
    originalProcessor?: ICliCommandProcessor;
    metadata = { icon: '💬', module: 'file management' };

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.echo.help.print_text_terminal_add', 'Print text to the terminal. Add > file to save it to a file (replacing it) or >> file to add it to the end.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['echo <text>', t.t('cli.echo.help.print_text', 'Print text')],
            ['echo <text> > <file>', t.t('cli.echo.help.write_text_file', 'Write text to a file')],
            ['echo <text> >> <file>', t.t('cli.echo.help.append_text_file', 'Append text to a file')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['echo Hello world', t.t('cli.echo.help.print_greeting', 'Print a greeting')],
            ['echo first line > notes.txt', t.t('cli.echo.help.create_replace_notes_txt', 'Create or replace notes.txt')],
            ['echo another line >> notes.txt', t.t('cli.echo.help.add_line', 'Add a line to it')],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        // Redirects (`echo a > f`) are handled by the engine before this
        // runs: a `>` that reaches here was escaped or came from a variable or
        // `$(...)`, and is printed, never used to write a file
        if (this.originalProcessor) {
            await this.originalProcessor.processCommand(command, context);
            return;
        }
        const text = joinShellWords(command.value || '');
        context.writer.writeln(text);
        context.process.output(text);
    }
}

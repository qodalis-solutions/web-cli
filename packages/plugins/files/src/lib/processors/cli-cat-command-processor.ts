import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    writeExamples,
    writeUsage,
    writeWrapped,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';
import { splitArgs } from '../utils/split-args';
import { pipedText } from '../utils/lines';

export class CliCatCommandProcessor implements ICliCommandProcessor {
    command = 'cat';
    description = 'Display file contents';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '📖', module: 'file management' };

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.cat.help.print_contents_one_more', 'Print the contents of one or more files, joined in order, or of piped input. Pipe the output into other commands to search, sort or count it.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['cat <file...>', t.t('cli.cat.help.print_files_one_after', 'Print files one after another')],
            ['cat <file> | <command>', t.t('cli.cat.help.send_file_another_command', 'Send a file to another command')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['cat notes.txt', t.t('cli.cat.help.show_whole_file', 'Show the whole file')],
            ['cat app.log | grep error', t.t('cli.cat.help.show_only_lines_error', 'Show only lines with error')],
            ['cat names.txt | sort', t.t('cli.cat.help.print_lines_sorted', 'Print the lines sorted')],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const paths = splitArgs(command.value || '');

        if (paths.length === 0) {
            if (command.data != null) {
                context.writer.writeln(pipedText(command.data));
                return;
            }
            context.writer.writeError('cat: missing file operand');
            return;
        }

        // Concatenate the files in order; a missing one is reported and skipped
        let output = '';
        for (const path of paths) {
            try {
                if (fs.isDirectory(path)) {
                    context.writer.writeError(`cat: ${path}: Is a directory`);
                    continue;
                }
                const content = fs.readFile(path);
                if (content === null) {
                    context.writer.writeError(
                        `cat: ${path}: No such file or directory`,
                    );
                    continue;
                }
                output += content;
            } catch (e: any) {
                context.writer.writeError(e.message);
            }
        }
        if (output !== '') {
            context.writer.writeln(output.replace(/\n$/, ''));
        }
    }
}

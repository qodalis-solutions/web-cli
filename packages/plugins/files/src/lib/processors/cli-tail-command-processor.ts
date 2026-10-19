import { splitArgs } from '../utils/split-args';
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
import { pipedText, splitLines } from '../utils/lines';

export class CliTailCommandProcessor implements ICliCommandProcessor {
    command = 'tail';
    description = 'Display the last lines of a file';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '⬇️', module: 'file management' };

    parameters = [
        {
            name: 'lines',
            aliases: ['n'],
            description: 'Number of lines to display (default: 10)',
            required: false,
            type: 'number' as const,
        },
    ];

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.tail.help.print_last_lines_file', 'Print the last lines of a file, 10 by default. Works on piped input too. With several files, each one gets a ==> name <== header.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['tail <file>', t.t('cli.tail.help.last_10_lines', 'Last 10 lines')],
            ['tail -n <count> <file>', t.t('cli.tail.help.last_lines', 'Last <count> lines')],
            ['<command> | tail', t.t('cli.tail.help.last_lines_piped_input', 'Last lines of piped input')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['tail app.log', t.t('cli.tail.help.show_end_log', 'Show the end of a log')],
            ['tail -n 5 notes.txt', t.t('cli.tail.help.last_5_lines', 'Last 5 lines')],
            ['cat app.log | tail -n 20', t.t('cli.tail.help.last_20_lines_log', 'Last 20 lines of the log')],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        // `-n 5`, `--lines 5`, or the short form `-5`
        const countArg =
            command.args['lines'] ??
            command.args['n'] ??
            Object.keys(command.args).find((k) => /^\d+$/.test(k));
        const parsedCount = parseInt(String(countArg ?? '10'), 10);
        const count = isNaN(parsedCount) ? 10 : Math.abs(parsedCount);
        const paths = this.parsePaths(command);

        if (paths.length === 0) {
            if (command.data != null) {
                const lines = splitLines(pipedText(command.data));
                const selected = count > 0 ? lines.slice(-count) : [];
                if (selected.length > 0) {
                    context.writer.writeln(selected.join('\n'));
                }
                return;
            }
            context.writer.writeError('tail: missing file operand');
            return;
        }

        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            try {
                if (fs.isDirectory(path)) {
                    context.writer.writeError(`tail: ${path}: Is a directory`);
                    continue;
                }
                const content = fs.readFile(path);
                if (content === null) continue;

                if (paths.length > 1) {
                    if (i > 0) context.writer.writeln();
                    context.writer.writeln(`==> ${path} <==`);
                }

                const lines = splitLines(content);
                const selected = count > 0 ? lines.slice(-count) : [];
                if (selected.length > 0) {
                    context.writer.writeln(selected.join('\n'));
                }
            } catch (e: any) {
                context.writer.writeError(`tail: ${e.message}`);
            }
        }
    }

    private parsePaths(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return splitArgs(raw).filter(Boolean);
    }
}

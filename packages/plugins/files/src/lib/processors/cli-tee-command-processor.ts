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
import { pipedText } from '../utils/lines';

export class CliTeeCommandProcessor implements ICliCommandProcessor {
    command = 'tee';
    description = 'Copy piped input to files and to the output';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '🔀', module: 'file management' };

    parameters = [
        {
            name: 'append',
            aliases: ['a'],
            description: 'Append to the given files, do not overwrite',
            required: false,
            type: 'boolean' as const,
        },
    ];

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.tee.help.pass_piped_input_through', 'Pass piped input through unchanged and save a copy of it to every file named, overwriting them or appending with -a. Like Unix tee, it reads only piped input: to copy a file, pipe it in with cat.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['<command> | tee <file...>', t.t('cli.tee.help.show_piped_output_save', 'Show piped output and save it')],
            ['<command> | tee -a <file>', t.t('cli.tee.help.append_instead_overwriting', 'Append instead of overwriting')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['cat notes.txt | tee copy.txt', t.t('cli.tee.help.show_save_copy', 'Show and save a copy')],
            ['echo done | tee -a log.txt', t.t('cli.tee.help.add_line_log', 'Add a line to a log')],
            [
                'cat source.txt | tee a.txt b.txt',
                t.t('cli.tee.help.copy_source_txt_txt', 'Copy source.txt into a.txt and b.txt'),
            ],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const append = command.args['append'] || command.args['a'] || false;

        if (command.data == null) {
            // Unix tee copies standard input; it never reads a file operand
            context.writer.writeError(
                "tee: no input: tee copies piped input to files and the output; use 'cat file | tee out.txt'",
            );
            context.process.exit(1, { silent: true });
            return;
        }

        // As Unix tee: the input goes unchanged to the output and to every
        // file named (overwritten, or appended with -a)
        const content = pipedText(command.data);
        context.writer.writeln(content);

        // Files get the text as a line, like a `>` redirect
        const fileText =
            content === '' || content.endsWith('\n') ? content : content + '\n';
        let changed = false;
        for (const outFile of this.getAllPaths(command)) {
            try {
                fs.writeFile(outFile, fileText, append);
                changed = true;
            } catch (e: any) {
                context.writer.writeError(`tee: ${e.message}`);
            }
        }
        if (changed) await fs.persist();
    }

    private getAllPaths(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return splitArgs(raw).filter(Boolean);
    }
}

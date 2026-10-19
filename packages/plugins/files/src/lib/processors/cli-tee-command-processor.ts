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

export class CliTeeCommandProcessor implements ICliCommandProcessor {
    command = 'tee';
    description = 'Read from a file and write to output files and stdout';
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
        writeWrapped(
            context,
            'Print text and save a copy of it to one or more files at the same time. With piped input, every file named receives the text. Without a pipe, the last file is the input and is copied to the others.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['<command> | tee <file...>', 'Show piped output and save it'],
            ['<command> | tee -a <file>', 'Append instead of overwriting'],
            ['tee <out...> <input>', 'Copy <input> to the other files'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['cat notes.txt | tee copy.txt', 'Show and save a copy'],
            ['echo done | tee -a log.txt', 'Add a line to a log'],
            [
                'tee a.txt b.txt source.txt',
                'Copy source.txt into a.txt and b.txt',
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
        const parsed = this.parseArgs(command);

        let content: string;

        if (command.data != null) {
            // Piped mode: all positional args are output files
            content =
                typeof command.data === 'string'
                    ? command.data
                    : JSON.stringify(command.data);
            const outputFiles = this.getAllPaths(command);

            // Write to stdout
            context.writer.writeln(content);

            // Write to each output file
            for (const outFile of outputFiles) {
                if (append && fs.exists(outFile)) {
                    fs.writeFile(outFile, content, true);
                } else {
                    fs.writeFile(outFile, content);
                }
            }
            await fs.persist();
        } else {
            // File mode: last arg is input, rest are output
            if (parsed.outputFiles.length === 0 && !parsed.inputFile) {
                context.writer.writeError('tee: missing operand');
                return;
            }

            if (!parsed.inputFile) {
                context.writer.writeError('tee: missing input file');
                return;
            }

            if (parsed.outputFiles.length === 0) {
                context.writer.writeError('tee: missing output file');
                return;
            }

            if (!fs.exists(parsed.inputFile)) {
                context.writer.writeError(
                    `tee: ${parsed.inputFile}: No such file or directory`,
                );
                return;
            }

            content = fs.readFile(parsed.inputFile) || '';

            // Write to stdout
            context.writer.writeln(content);

            // Write to each output file
            for (const outFile of parsed.outputFiles) {
                if (append && fs.exists(outFile)) {
                    fs.writeFile(outFile, content, true);
                } else {
                    fs.writeFile(outFile, content);
                }
            }

            await fs.persist();
        }
    }

    private getAllPaths(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return raw.split(/\s+/).filter(Boolean);
    }

    private parseArgs(command: CliProcessCommand): {
        outputFiles: string[];
        inputFile: string | null;
    } {
        const raw = command.value || '';
        const paths = raw.split(/\s+/).filter(Boolean);

        // Last path is input file, rest are output files
        if (paths.length < 2) {
            return {
                outputFiles: [],
                inputFile: paths[0] || null,
            };
        }

        const inputFile = paths[paths.length - 1];
        const outputFiles = paths.slice(0, paths.length - 1);
        return { outputFiles, inputFile };
    }
}

import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
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

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
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

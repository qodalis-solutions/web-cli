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

export class CliPasteCommandProcessor implements ICliCommandProcessor {
    command = 'paste';
    description = 'Merge lines of files side by side';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '\u{1F4CB}', module: 'file management' };

    parameters = [
        {
            name: 'delimiters',
            aliases: ['d'],
            description: 'Use a specific delimiter (default: tab)',
            required: false,
            type: 'string' as const,
        },
        {
            name: 'serial',
            aliases: ['s'],
            description:
                'Paste one file at a time instead of in parallel',
            required: false,
            type: 'boolean' as const,
        },
    ];

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'Join files side by side: line 1 of each file goes on one output line, separated by a tab, then line 2, and so on. With -s, each file is joined onto a single line instead. Piped input is read as the file - (or as the only input when no file is named); -d takes a list of delimiters used in turn.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['paste <file1> <file2...>', 'Merge files line by line'],
            ['paste -s <file>', 'Join all lines of a file into one'],
            ['<command> | paste - <file>', 'Merge piped input with a file'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['paste names.txt ages.txt', 'Two columns, tab separated'],
            ['paste -d , a.txt b.txt', 'Merge as comma-separated'],
            ['paste -s -d , list.txt', 'Turn a list into one CSV line'],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );

        const delimiterArg =
            command.args['d'] ?? command.args['delimiters'] ?? '\t';
        const delimiters = this.parseDelimiters(String(delimiterArg));
        const serial = !!command.args['s'] || !!command.args['serial'];

        const paths = this.parsePaths(command);
        const hasStdin = command.data != null;

        if (paths.length === 0) {
            if (!hasStdin) {
                context.writer.writeError('paste: missing file operand');
                return;
            }
            // Piped input alone is the single input file
            paths.push('-');
        }

        // Read all inputs ('-' is the piped input)
        const fileLines: string[][] = [];
        for (const path of paths) {
            if (path === '-' && hasStdin) {
                fileLines.push(splitLines(pipedText(command.data)));
                continue;
            }
            try {
                if (fs.isDirectory(path)) {
                    context.writer.writeError(
                        `paste: ${path}: Is a directory`,
                    );
                    return;
                }
                const content = fs.readFile(path);
                if (content === null) {
                    context.writer.writeError(
                        `paste: ${path}: No such file or directory`,
                    );
                    return;
                }
                fileLines.push(splitLines(content));
            } catch (e: any) {
                context.writer.writeError(`paste: ${e.message}`);
                return;
            }
        }

        const join = (parts: string[]): string =>
            parts.reduce(
                (line, part, i) =>
                    i === 0
                        ? part
                        : line + delimiters[(i - 1) % delimiters.length] + part,
                '',
            );

        if (serial) {
            // Serial mode: each file's lines joined on one output line
            const output = fileLines.map((lines) => join(lines));
            context.writer.writeln(output.join('\n'));
        } else {
            // Parallel mode: zip lines from all files
            const maxLines = Math.max(
                ...fileLines.map((lines) => lines.length),
            );
            const output: string[] = [];
            for (let i = 0; i < maxLines; i++) {
                output.push(join(fileLines.map((lines) => lines[i] ?? '')));
            }
            context.writer.writeln(output.join('\n'));
        }
    }

    /** `-d` list: each character in turn, with \t, \n, \\ and \0 (empty) escapes. */
    private parseDelimiters(list: string): string[] {
        const result: string[] = [];
        for (let i = 0; i < list.length; i++) {
            if (list[i] === '\\' && i + 1 < list.length) {
                const next = list[++i];
                result.push(
                    next === 't' ? '\t' : next === 'n' ? '\n' : next === '0' ? '' : next,
                );
            } else {
                result.push(list[i]);
            }
        }
        return result.length > 0 ? result : ['\t'];
    }

    /**
     * The file operands. The engine drops a lone `-` from the value, so with
     * piped input they are read from the raw command line to keep it.
     */
    private parsePaths(command: CliProcessCommand): string[] {
        const fromValue = splitArgs(command.value || '').filter(Boolean);
        if (command.data == null || !command.rawCommand) return fromValue;

        const words = splitArgs(command.rawCommand).slice(1);
        if (!words.includes('-')) return fromValue;
        const result: string[] = [];
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            if (word === '-' || !word.startsWith('-')) {
                result.push(word);
            } else if (/^(-d|--delimiters)$/.test(word)) {
                i++; // its value
            }
        }
        return result;
    }
}

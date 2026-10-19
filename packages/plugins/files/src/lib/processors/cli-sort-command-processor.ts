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

export class CliSortCommandProcessor implements ICliCommandProcessor {
    command = 'sort';
    description = 'Sort lines of text files';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '\u{1F524}', module: 'file management' };

    parameters = [
        {
            name: 'reverse',
            aliases: ['r'],
            description: 'Reverse the result of comparisons',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'numeric-sort',
            aliases: ['n'],
            description: 'Compare according to string numerical value',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'unique',
            aliases: ['u'],
            description: 'Output only unique lines',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'key',
            aliases: ['k'],
            description: 'Sort by a specific field (1-indexed)',
            required: false,
            type: 'string' as const,
        },
        {
            name: 'field-separator',
            aliases: ['t'],
            description: 'Use a specific field delimiter',
            required: false,
            type: 'string' as const,
        },
    ];

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.sort.help.sort_lines_file_piped', 'Sort the lines of a file or piped input, alphabetically by default. Sort numerically, in reverse, by a field, or drop duplicates. Several files are sorted together into one list.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['sort <file>', t.t('cli.sort.help.sort_lines_alphabetically', 'Sort lines alphabetically')],
            [
                'sort -k <n> -t <sep> <file>',
                t.t('cli.sort.help.sort_field_split', 'Sort by field <n>, split on <sep>'),
            ],
            ['<command> | sort', t.t('cli.sort.help.sort_piped_input', 'Sort piped input')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['sort names.txt', t.t('cli.sort.help.z', 'A to Z')],
            ['sort -n -r scores.txt', t.t('cli.sort.help.largest_number_first', 'Largest number first')],
            ['sort -t , -k 2 data.csv', t.t('cli.sort.help.sort_csv_second_column', 'Sort a CSV by its second column')],
            ['cat words.txt | sort -u', t.t('cli.sort.help.sorted_without_duplicates', 'Sorted, without duplicates')],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );

        const reverse = !!command.args['r'] || !!command.args['reverse'];
        const numeric = !!command.args['n'] || !!command.args['numeric-sort'];
        const unique = !!command.args['u'] || !!command.args['unique'];
        const keyField = command.args['k'] ?? command.args['key'];
        const delimiter = command.args['t'] ?? command.args['field-separator'];

        const paths = this.parsePaths(command);
        let lines: string[] = [];

        if (paths.length === 0) {
            if (command.data == null) {
                context.writer.writeError('sort: missing file operand');
                return;
            }
            lines = splitLines(pipedText(command.data));
        } else {
            // Several files are sorted together, as one input
            for (const path of paths) {
                try {
                    if (fs.isDirectory(path)) {
                        context.writer.writeError(
                            `sort: ${path}: Is a directory`,
                        );
                        continue;
                    }
                    const content = fs.readFile(path);
                    if (content === null) {
                        context.writer.writeError(
                            `sort: ${path}: No such file or directory`,
                        );
                        continue;
                    }
                    lines.push(...splitLines(content));
                } catch (e: any) {
                    context.writer.writeError(`sort: ${e.message}`);
                }
            }
        }

        const keyIndex =
            keyField != null && keyField !== true
                ? parseInt(String(keyField), 10) - 1
                : undefined;
        const sepRegex =
            delimiter != null && delimiter !== true
                ? new RegExp(
                      String(delimiter).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                  )
                : /\s+/;
        const keyOf = (line: string): string =>
            keyIndex !== undefined && keyIndex >= 0
                ? line.split(sepRegex)[keyIndex] || ''
                : line;
        const compare = (a: string, b: string): number => {
            const va = keyOf(a);
            const vb = keyOf(b);
            if (numeric) {
                return (parseFloat(va) || 0) - (parseFloat(vb) || 0);
            }
            return va.localeCompare(vb);
        };

        lines.sort(compare);

        if (unique) {
            lines = lines.filter(
                (line, i, arr) => i === 0 || compare(line, arr[i - 1]) !== 0,
            );
        }

        if (reverse) {
            lines.reverse();
        }

        if (lines.length > 0) {
            context.writer.writeln(lines.join('\n'));
        }
    }

    private parsePaths(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return splitArgs(raw).filter(Boolean);
    }
}

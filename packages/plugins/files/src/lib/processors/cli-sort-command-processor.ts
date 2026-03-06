import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

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

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );

        const reverse = !!command.args['r'] || !!command.args['reverse'];
        const numeric = !!command.args['n'] || !!command.args['numeric-sort'];
        const unique = !!command.args['u'] || !!command.args['unique'];
        const keyField = command.args['k'] || command.args['key'];
        const delimiter = command.args['t'] || command.args['field-separator'];

        const paths = this.parsePaths(command);

        if (paths.length === 0) {
            if (command.data != null) {
                const content = typeof command.data === 'string'
                    ? command.data : JSON.stringify(command.data);
                let lines = content.split('\n');
                if (lines.length > 0 && lines[lines.length - 1] === '') {
                    lines.pop();
                }

                const keyIndex = keyField
                    ? parseInt(keyField, 10) - 1
                    : undefined;

                lines.sort((a, b) => {
                    let va: string | number = a;
                    let vb: string | number = b;

                    if (keyIndex !== undefined && keyIndex >= 0) {
                        const sepRegex = delimiter
                            ? new RegExp(
                                  delimiter.replace(
                                      /[.*+?^${}()|[\]\\]/g,
                                      '\\$&',
                                  ),
                              )
                            : /\s+/;
                        const fieldsA = a.split(sepRegex);
                        const fieldsB = b.split(sepRegex);
                        va = fieldsA[keyIndex] || '';
                        vb = fieldsB[keyIndex] || '';
                    }

                    if (numeric) {
                        const na = parseFloat(va as string) || 0;
                        const nb = parseFloat(vb as string) || 0;
                        return na - nb;
                    }

                    return (va as string).localeCompare(vb as string);
                });

                if (unique) {
                    lines = lines.filter(
                        (line, i, arr) => i === 0 || line !== arr[i - 1],
                    );
                }

                if (reverse) {
                    lines.reverse();
                }

                context.writer.writeln(lines.join('\n'));
                return;
            }
            context.writer.writeError('sort: missing file operand');
            return;
        }

        for (const path of paths) {
            try {
                if (fs.isDirectory(path)) {
                    context.writer.writeError(`sort: ${path}: Is a directory`);
                    continue;
                }
                const content = fs.readFile(path);
                if (content === null) {
                    context.writer.writeError(
                        `sort: ${path}: No such file or directory`,
                    );
                    continue;
                }

                let lines = content.split('\n');
                // Remove trailing empty line from trailing newline
                if (lines.length > 0 && lines[lines.length - 1] === '') {
                    lines.pop();
                }

                const keyIndex = keyField
                    ? parseInt(keyField, 10) - 1
                    : undefined;

                lines.sort((a, b) => {
                    let va: string | number = a;
                    let vb: string | number = b;

                    if (keyIndex !== undefined && keyIndex >= 0) {
                        const sepRegex = delimiter
                            ? new RegExp(
                                  delimiter.replace(
                                      /[.*+?^${}()|[\]\\]/g,
                                      '\\$&',
                                  ),
                              )
                            : /\s+/;
                        const fieldsA = a.split(sepRegex);
                        const fieldsB = b.split(sepRegex);
                        va = fieldsA[keyIndex] || '';
                        vb = fieldsB[keyIndex] || '';
                    }

                    if (numeric) {
                        const na = parseFloat(va as string) || 0;
                        const nb = parseFloat(vb as string) || 0;
                        return na - nb;
                    }

                    return (va as string).localeCompare(vb as string);
                });

                if (unique) {
                    lines = lines.filter(
                        (line, i, arr) => i === 0 || line !== arr[i - 1],
                    );
                }

                if (reverse) {
                    lines.reverse();
                }

                context.writer.writeln(lines.join('\n'));
            } catch (e: any) {
                context.writer.writeError(`sort: ${e.message}`);
            }
        }
    }

    private parsePaths(command: CliProcessCommand): string[] {
        const raw = command.rawCommand || '';
        const tokens = raw.split(/\s+/).filter(Boolean);
        const paths: string[] = [];
        let i = 0;
        while (i < tokens.length) {
            const t = tokens[i];
            if (
                t === '-k' ||
                t === '--key' ||
                t === '-t' ||
                t === '--field-separator'
            ) {
                i += 2;
            } else if (t.startsWith('-')) {
                i++;
            } else {
                paths.push(t);
                i++;
            }
        }
        return paths;
    }
}

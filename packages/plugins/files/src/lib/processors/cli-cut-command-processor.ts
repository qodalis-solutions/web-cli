import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliCutCommandProcessor implements ICliCommandProcessor {
    command = 'cut';
    description = 'Extract columns or fields from each line of a file';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '\u2702\uFE0F', module: 'file management' };

    parameters = [
        {
            name: 'delimiter',
            aliases: ['d'],
            description: 'Use a specific field delimiter (default: tab)',
            required: false,
            type: 'string' as const,
        },
        {
            name: 'fields',
            aliases: ['f'],
            description: 'Select only these fields (e.g., 1,3 or 1-3)',
            required: false,
            type: 'string' as const,
        },
        {
            name: 'characters',
            aliases: ['c'],
            description:
                'Select only these character positions (e.g., 1-5 or 3)',
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

        const delimiter = command.args['d'] || command.args['delimiter'] || '\t';
        const fieldsSpec = command.args['f'] || command.args['fields'];
        const charsSpec = command.args['c'] || command.args['characters'];

        if (!fieldsSpec && !charsSpec) {
            context.writer.writeError(
                'cut: you must specify either -f (fields) or -c (characters)',
            );
            return;
        }

        const spec = fieldsSpec || charsSpec!;
        const indices = this.parseSpec(spec);
        const paths = this.parsePaths(command);

        if (paths.length === 0) {
            if (command.data != null) {
                const content = typeof command.data === 'string'
                    ? command.data : JSON.stringify(command.data);
                let lines = content.split('\n');
                if (lines.length > 0 && lines[lines.length - 1] === '') {
                    lines.pop();
                }

                const output = lines.map((line) => {
                    if (fieldsSpec) {
                        const fields = line.split(delimiter);
                        const resolved = this.resolveIndices(
                            indices,
                            fields.length,
                        );
                        return resolved
                            .map((idx) => fields[idx] || '')
                            .join(delimiter);
                    } else {
                        const chars = line.split('');
                        const resolved = this.resolveIndices(
                            indices,
                            chars.length,
                        );
                        return resolved.map((idx) => chars[idx] || '').join('');
                    }
                });

                context.writer.writeln(output.join('\n'));
                return;
            }
            context.writer.writeError('cut: missing file operand');
            return;
        }

        for (const path of paths) {
            try {
                if (fs.isDirectory(path)) {
                    context.writer.writeError(
                        `cut: ${path}: Is a directory`,
                    );
                    continue;
                }
                const content = fs.readFile(path);
                if (content === null) {
                    context.writer.writeError(
                        `cut: ${path}: No such file or directory`,
                    );
                    continue;
                }

                let lines = content.split('\n');
                // Remove trailing empty line from trailing newline
                if (lines.length > 0 && lines[lines.length - 1] === '') {
                    lines.pop();
                }

                const output = lines.map((line) => {
                    if (fieldsSpec) {
                        const fields = line.split(delimiter);
                        const resolved = this.resolveIndices(
                            indices,
                            fields.length,
                        );
                        return resolved
                            .map((idx) => fields[idx] || '')
                            .join(delimiter);
                    } else {
                        // character mode
                        const chars = line.split('');
                        const resolved = this.resolveIndices(
                            indices,
                            chars.length,
                        );
                        return resolved.map((idx) => chars[idx] || '').join('');
                    }
                });

                context.writer.writeln(output.join('\n'));
            } catch (e: any) {
                context.writer.writeError(`cut: ${e.message}`);
            }
        }
    }

    private parseSpec(
        spec: string,
    ): Array<{ type: 'index'; value: number } | { type: 'range'; start: number | null; end: number | null }> {
        const parts = spec.split(',');
        const result: Array<
            | { type: 'index'; value: number }
            | { type: 'range'; start: number | null; end: number | null }
        > = [];

        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.includes('-')) {
                const [startStr, endStr] = trimmed.split('-');
                const start = startStr ? parseInt(startStr, 10) : null;
                const end = endStr ? parseInt(endStr, 10) : null;
                result.push({ type: 'range', start, end });
            } else {
                result.push({ type: 'index', value: parseInt(trimmed, 10) });
            }
        }

        return result;
    }

    private resolveIndices(
        specs: Array<
            | { type: 'index'; value: number }
            | { type: 'range'; start: number | null; end: number | null }
        >,
        total: number,
    ): number[] {
        const indices: number[] = [];

        for (const spec of specs) {
            if (spec.type === 'index') {
                indices.push(spec.value - 1);
            } else {
                const start = spec.start ? spec.start - 1 : 0;
                const end = spec.end ? spec.end - 1 : total - 1;
                for (let i = start; i <= end; i++) {
                    indices.push(i);
                }
            }
        }

        return indices;
    }

    private parsePaths(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return raw.split(/\s+/).filter(Boolean);
    }
}

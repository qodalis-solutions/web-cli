import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliUniqCommandProcessor implements ICliCommandProcessor {
    command = 'uniq';
    description = 'Filter adjacent duplicate lines from a file';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '\u{1F501}', module: 'file management' };

    parameters = [
        {
            name: 'count',
            aliases: ['c'],
            description: 'Prefix lines by the number of occurrences',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'repeated',
            aliases: ['d'],
            description: 'Only print duplicate lines',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'ignore-case',
            aliases: ['i'],
            description: 'Ignore differences in case when comparing',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'unique',
            aliases: ['u'],
            description: 'Only print unique lines',
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

        const showCount = !!command.args['c'] || !!command.args['count'];
        const onlyDuplicates =
            !!command.args['d'] || !!command.args['repeated'];
        const ignoreCase =
            !!command.args['i'] || !!command.args['ignore-case'];
        const onlyUnique = !!command.args['u'] || !!command.args['unique'];

        const paths = this.parsePaths(command);

        if (paths.length === 0) {
            if (command.data != null) {
                const content = typeof command.data === 'string'
                    ? command.data : JSON.stringify(command.data);
                let lines = content.split('\n');
                if (lines.length > 0 && lines[lines.length - 1] === '') {
                    lines.pop();
                }

                const groups: { line: string; count: number }[] = [];
                for (const line of lines) {
                    const last = groups[groups.length - 1];
                    const compare = ignoreCase
                        ? (a: string, b: string) =>
                              a.toLowerCase() === b.toLowerCase()
                        : (a: string, b: string) => a === b;
                    if (last && compare(last.line, line)) {
                        last.count++;
                    } else {
                        groups.push({ line, count: 1 });
                    }
                }

                let filtered = groups;
                if (onlyDuplicates) {
                    filtered = filtered.filter((g) => g.count > 1);
                }
                if (onlyUnique) {
                    filtered = filtered.filter((g) => g.count === 1);
                }

                const output = filtered.map((g) => {
                    if (showCount) {
                        return `${String(g.count).padStart(7)} ${g.line}`;
                    }
                    return g.line;
                });

                context.writer.writeln(output.join('\n'));
                return;
            }
            context.writer.writeError('uniq: missing file operand');
            return;
        }

        for (const path of paths) {
            try {
                if (fs.isDirectory(path)) {
                    context.writer.writeError(
                        `uniq: ${path}: Is a directory`,
                    );
                    continue;
                }
                const content = fs.readFile(path);
                if (content === null) {
                    context.writer.writeError(
                        `uniq: ${path}: No such file or directory`,
                    );
                    continue;
                }

                let lines = content.split('\n');
                // Remove trailing empty line from trailing newline
                if (lines.length > 0 && lines[lines.length - 1] === '') {
                    lines.pop();
                }

                // Group consecutive identical lines
                const groups: { line: string; count: number }[] = [];
                for (const line of lines) {
                    const last = groups[groups.length - 1];
                    const compare = ignoreCase
                        ? (a: string, b: string) =>
                              a.toLowerCase() === b.toLowerCase()
                        : (a: string, b: string) => a === b;
                    if (last && compare(last.line, line)) {
                        last.count++;
                    } else {
                        groups.push({ line, count: 1 });
                    }
                }

                // Filter based on flags
                let filtered = groups;
                if (onlyDuplicates) {
                    filtered = filtered.filter((g) => g.count > 1);
                }
                if (onlyUnique) {
                    filtered = filtered.filter((g) => g.count === 1);
                }

                // Format output
                const output = filtered.map((g) => {
                    if (showCount) {
                        return `${String(g.count).padStart(7)} ${g.line}`;
                    }
                    return g.line;
                });

                context.writer.writeln(output.join('\n'));
            } catch (e: any) {
                context.writer.writeError(`uniq: ${e.message}`);
            }
        }
    }

    private parsePaths(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return raw.split(/\s+/).filter(Boolean);
    }
}

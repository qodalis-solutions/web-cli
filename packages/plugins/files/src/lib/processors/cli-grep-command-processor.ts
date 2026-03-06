import {
    CliForegroundColor,
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import {
    IFileSystemService,
    IFileSystemService_TOKEN,
    IFileNode,
} from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliGrepCommandProcessor implements ICliCommandProcessor {
    command = 'grep';
    description = 'Search file contents for a pattern';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    metadata = { icon: '🔎', module: 'file management' };

    parameters = [
        {
            name: 'ignore-case',
            aliases: ['i'],
            description: 'Case-insensitive matching',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'recursive',
            aliases: ['r', 'R'],
            description: 'Recursively search directories',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'line-number',
            aliases: ['n'],
            description: 'Show line numbers',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'count',
            aliases: ['c'],
            description: 'Show only a count of matching lines per file',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'files-with-matches',
            aliases: ['l'],
            description: 'Show only filenames containing matches',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'invert-match',
            aliases: ['v'],
            description: 'Select non-matching lines',
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

        const ignoreCase =
            command.args['ignore-case'] || command.args['i'] || false;
        const recursive =
            command.args['recursive'] ||
            command.args['r'] ||
            command.args['R'] ||
            false;
        const showLineNum =
            command.args['line-number'] || command.args['n'] || false;
        const countOnly =
            command.args['count'] || command.args['c'] || false;
        const filesOnly =
            command.args['files-with-matches'] || command.args['l'] || false;
        const invert =
            command.args['invert-match'] || command.args['v'] || false;

        const { pattern, paths } = this.parseArgs(command);
        if (!pattern) {
            context.writer.writeError(
                'grep: missing pattern. Usage: grep [options] <pattern> <file>',
            );
            return;
        }
        if (paths.length === 0) {
            context.writer.writeError(
                'grep: missing file operand. Usage: grep [options] <pattern> <file>',
            );
            return;
        }

        let regex: RegExp;
        try {
            regex = new RegExp(pattern, ignoreCase ? 'gi' : 'g');
        } catch {
            context.writer.writeError(`grep: invalid pattern '${pattern}'`);
            return;
        }

        const filePaths: string[] = [];
        for (const p of paths) {
            try {
                if (!fs.exists(p)) {
                    context.writer.writeError(
                        `grep: ${p}: No such file or directory`,
                    );
                    continue;
                }
                if (fs.isDirectory(p)) {
                    if (!recursive) {
                        context.writer.writeError(
                            `grep: ${p}: Is a directory`,
                        );
                        continue;
                    }
                    this.collectFiles(fs, fs.resolvePath(p), fs.getNode(p)!, filePaths);
                } else {
                    filePaths.push(fs.resolvePath(p));
                }
            } catch (e: any) {
                context.writer.writeError(`grep: ${e.message}`);
            }
        }

        const multiFile = filePaths.length > 1;

        for (const filePath of filePaths) {
            try {
                const content = fs.readFile(filePath) ?? '';
                const lines = content.split('\n');
                let matchCount = 0;
                const matchingLines: { num: number; text: string }[] = [];

                for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
                    const line = lines[lineIdx];
                    regex.lastIndex = 0;
                    const hasMatch = regex.test(line);
                    const isMatch = invert ? !hasMatch : hasMatch;

                    if (isMatch) {
                        matchCount++;
                        matchingLines.push({
                            num: lineIdx + 1,
                            text: line,
                        });
                    }
                }

                if (filesOnly) {
                    if (matchCount > 0) {
                        context.writer.writeln(filePath);
                    }
                } else if (countOnly) {
                    const prefix = multiFile ? `${filePath}:` : '';
                    context.writer.writeln(`${prefix}${matchCount}`);
                } else {
                    for (const m of matchingLines) {
                        const parts: string[] = [];
                        if (multiFile) {
                            parts.push(
                                context.writer.wrapInColor(
                                    filePath,
                                    CliForegroundColor.Magenta,
                                ),
                            );
                            parts.push(':');
                        }
                        if (showLineNum) {
                            parts.push(
                                context.writer.wrapInColor(
                                    String(m.num),
                                    CliForegroundColor.Green,
                                ),
                            );
                            parts.push(':');
                        }

                        if (!invert) {
                            regex.lastIndex = 0;
                            const highlighted = m.text.replace(
                                regex,
                                (match) =>
                                    context.writer.wrapInColor(
                                        match,
                                        CliForegroundColor.Red,
                                    ),
                            );
                            parts.push(highlighted);
                        } else {
                            parts.push(m.text);
                        }

                        context.writer.writeln(parts.join(''));
                    }
                }
            } catch (e: any) {
                context.writer.writeError(`grep: ${filePath}: ${e.message}`);
            }
        }
    }

    private parseArgs(
        command: CliProcessCommand,
    ): { pattern: string | null; paths: string[] } {
        const raw = command.rawCommand || '';
        const tokens = raw.split(/\s+/).filter(Boolean);
        const nonFlags: string[] = [];

        // Skip the first token — it's the command name ("grep")
        let i = 1;
        while (i < tokens.length) {
            const t = tokens[i];
            if (t.startsWith('-')) {
                i++;
            } else {
                nonFlags.push(t);
                i++;
            }
        }

        if (nonFlags.length === 0) {
            return { pattern: null, paths: [] };
        }
        if (nonFlags.length === 1) {
            return { pattern: nonFlags[0], paths: [] };
        }

        return {
            pattern: nonFlags[0],
            paths: nonFlags.slice(1),
        };
    }

    private collectFiles(
        fs: IFileSystemService,
        basePath: string,
        node: IFileNode,
        result: string[],
    ): void {
        if (!node.children) return;
        for (const child of node.children) {
            const childPath =
                basePath === '/'
                    ? `/${child.name}`
                    : `${basePath}/${child.name}`;
            if (child.type === 'file') {
                result.push(childPath);
            } else if (child.type === 'directory') {
                this.collectFiles(fs, childPath, child, result);
            }
        }
    }
}

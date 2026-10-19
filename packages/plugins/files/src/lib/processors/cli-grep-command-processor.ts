import { splitArgs } from '../utils/split-args';
import { readableChildren } from '../utils/readable-children';
import {
    CliForegroundColor,
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    writeExamples,
    writeUsage,
    writeWrapped,
} from '@qodalis/cli-core';
import {
    IFileSystemService,
    IFileSystemService_TOKEN,
    IFileNode,
} from '../interfaces';
import { LIBRARY_VERSION } from '../version';
import { splitLines } from '../utils/lines';

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
            name: 'quiet',
            aliases: ['q'],
            description: 'Print nothing; only the exit status tells whether a line matched',
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
        {
            name: 'word-regexp',
            aliases: ['w'],
            description: 'Match only whole words',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'only-matching',
            aliases: ['o'],
            description: 'Print only the matched parts, one per line',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'extended-regexp',
            aliases: ['E'],
            description: 'Extended regular expressions (patterns always are)',
            required: false,
            type: 'boolean' as const,
        },
    ];

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.grep.help.print_lines_match_pattern', 'Print the lines that match a pattern. The pattern is a regular expression, matches are highlighted, and the input can be files, directories (with -r) or piped text.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['grep <pattern> <file...>', t.t('cli.grep.help.search_one_more_files', 'Search one or more files')],
            ['grep -r <pattern> <dir>', t.t('cli.grep.help.search_every_file_under', 'Search every file under a directory')],
            ['<command> | grep <pattern>', t.t('cli.grep.help.filter_piped_input', 'Filter piped input')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['grep -i error app.log', t.t('cli.grep.help.case_insensitive_search', 'Case-insensitive search')],
            ['grep -r -n TODO src', t.t('cli.grep.help.find_todos_line_numbers', 'Find TODOs with line numbers')],
            ['grep -v ^# config.txt', t.t('cli.grep.help.hide_comment_lines', 'Hide comment lines')],
            ['cat app.log | grep -c ERROR', t.t('cli.grep.help.count_matching_lines', 'Count matching lines')],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
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

        const wordRegexp =
            command.args['word-regexp'] || command.args['w'] || false;
        const onlyMatching =
            command.args['only-matching'] || command.args['o'] || false;
        const quiet = command.args['quiet'] || command.args['q'] || false;

        const { pattern, paths } = this.parseArgs(command);
        if (!pattern) {
            context.writer.writeError(
                'grep: missing pattern. Usage: grep [options] <pattern> <file>',
            );
            context.process.exit(2, { silent: true });
            return;
        }
        let regex: RegExp;
        try {
            const source = wordRegexp ? `(?<!\\w)(?:${pattern})(?!\\w)` : pattern;
            regex = new RegExp(source, ignoreCase ? 'gi' : 'g');
        } catch {
            context.writer.writeError(`grep: invalid pattern '${pattern}'`);
            context.process.exit(2, { silent: true });
            return;
        }
        if (paths.length === 0) {
            if (command.data != null) {
                const content = typeof command.data === 'string'
                    ? command.data
                    : JSON.stringify(command.data);
                const found = this.grepContent(content, null, regex, {
                    ignoreCase, showLineNum, countOnly, filesOnly, invert, onlyMatching, quiet,
                }, context, false);
                this.exitStatus(context, found, false);
                return;
            }
            context.writer.writeError(
                'grep: missing file operand. Usage: grep [options] <pattern> <file>',
            );
            context.process.exit(2, { silent: true });
            return;
        }

        const filePaths: string[] = [];
        let failed = false;
        for (const p of paths) {
            try {
                if (!fs.exists(p)) {
                    context.writer.writeError(
                        `grep: ${p}: No such file or directory`,
                    );
                    failed = true;
                    continue;
                }
                if (fs.isDirectory(p)) {
                    if (!recursive) {
                        context.writer.writeError(
                            `grep: ${p}: Is a directory`,
                        );
                        failed = true;
                        continue;
                    }
                    this.collectFiles(fs, fs.resolvePath(p), fs.getNode(p)!, filePaths);
                } else {
                    filePaths.push(fs.resolvePath(p));
                }
            } catch (e: any) {
                context.writer.writeError(`grep: ${e.message}`);
                failed = true;
            }
        }

        const multiFile = filePaths.length > 1;

        let found = 0;
        for (const filePath of filePaths) {
            try {
                const content = fs.readFile(filePath) ?? '';
                found += this.grepContent(content, filePath, regex, {
                    ignoreCase, showLineNum, countOnly, filesOnly, invert, onlyMatching, quiet,
                }, context, multiFile);
            } catch (e: any) {
                context.writer.writeError(`grep: ${filePath}: ${e.message}`);
                failed = true;
            }
        }
        this.exitStatus(context, found, failed);
    }

    /**
     * As Unix grep: 0 when a line matched, 1 when none did, 2 after an
     * error (so `if grep -q ...` and `grep x f && ...` work).
     */
    private exitStatus(context: ICliExecutionContext, found: number, failed: boolean): void {
        if (found > 0) return;
        context.process.exit(failed ? 2 : 1, { silent: true });
    }

    private grepContent(
        content: string,
        filePath: string | null,
        regex: RegExp,
        options: {
            ignoreCase: boolean;
            showLineNum: boolean;
            countOnly: boolean;
            filesOnly: boolean;
            invert: boolean;
            onlyMatching: boolean;
            quiet?: boolean;
        },
        context: ICliExecutionContext,
        multiFile: boolean,
    ): number {
        const lines = splitLines(content);
        let matchCount = 0;
        const matchingLines: { num: number; text: string }[] = [];

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            regex.lastIndex = 0;
            const hasMatch = regex.test(line);
            const isMatch = options.invert ? !hasMatch : hasMatch;

            if (isMatch) {
                matchCount++;
                matchingLines.push({ num: lineIdx + 1, text: line });
            }
        }

        if (options.quiet) return matchCount;

        if (options.filesOnly) {
            if (matchCount > 0 && filePath) {
                context.writer.writeln(filePath);
            }
        } else if (options.countOnly) {
            const prefix = multiFile && filePath ? `${filePath}:` : '';
            context.writer.writeln(`${prefix}${matchCount}`);
        } else {
            for (const m of matchingLines) {
                const parts: string[] = [];
                if (multiFile && filePath) {
                    parts.push(context.writer.wrapInColor(filePath, CliForegroundColor.Magenta));
                    parts.push(':');
                }
                if (options.showLineNum) {
                    parts.push(context.writer.wrapInColor(String(m.num), CliForegroundColor.Green));
                    parts.push(':');
                }
                if (options.onlyMatching && !options.invert) {
                    regex.lastIndex = 0;
                    const prefix = parts.join('');
                    for (const match of m.text.match(regex) ?? []) {
                        if (match !== '') {
                            context.writer.writeln(
                                prefix + context.writer.wrapInColor(match, CliForegroundColor.Red),
                            );
                        }
                    }
                    continue;
                }
                if (!options.invert) {
                    regex.lastIndex = 0;
                    const highlighted = m.text.replace(regex, (match) =>
                        context.writer.wrapInColor(match, CliForegroundColor.Red),
                    );
                    parts.push(highlighted);
                } else {
                    parts.push(m.text);
                }
                context.writer.writeln(parts.join(''));
            }
        }
        return matchCount;
    }

    private parseArgs(
        command: CliProcessCommand,
    ): { pattern: string | null; paths: string[] } {
        const raw = command.value || '';
        const tokens = splitArgs(raw).filter(Boolean);

        if (tokens.length === 0) {
            return { pattern: null, paths: [] };
        }
        if (tokens.length === 1) {
            return { pattern: tokens[0], paths: [] };
        }

        return {
            pattern: tokens[0],
            paths: tokens.slice(1),
        };
    }

    private collectFiles(
        fs: IFileSystemService,
        basePath: string,
        node: IFileNode,
        result: string[],
    ): void {
        const children = readableChildren(fs, basePath);
        if (!children) return;
        for (const child of children) {
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

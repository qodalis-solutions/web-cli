import { splitArgs } from '../utils/split-args';
import { readableChildren } from '../utils/readable-children';
import {
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

export class CliFindCommandProcessor implements ICliCommandProcessor {
    command = 'find';
    description = 'Search for files and directories by name or type';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    metadata = { icon: '🔍', module: 'file management' };

    parameters = [
        {
            name: 'name',
            description: 'Match filename pattern (glob: * and ? supported), case-sensitive',
            required: false,
            type: 'string' as const,
        },
        {
            name: 'iname',
            description: 'Like --name, but case-insensitive',
            required: false,
            type: 'string' as const,
        },
        {
            name: 'type',
            description: 'Filter by type: f (file) or d (directory)',
            required: false,
            type: 'string' as const,
        },
        {
            name: 'maxdepth',
            description: 'Maximum depth: 0 is only the start path, 1 its direct children',
            required: false,
            type: 'number' as const,
        },
    ];

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'List files and directories under a path (the current directory by default), searching all subdirectories. The start path itself is listed first. Filter by name with a glob pattern (* and ?; --name is case-sensitive, --iname is not) or by type.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['find [path]', 'List everything under a path'],
            ['find [path] --name <pattern>', 'Match names against a glob'],
            ['find [path] --iname <pattern>', 'Same, ignoring case'],
            ['find [path] --type f|d', 'Only files (f) or directories (d)'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['find ~/docs', 'List everything in ~/docs'],
            ['find . --name *.txt', 'Find all .txt files'],
            ['find . --type d --maxdepth 1', 'Directories near the top'],
            ['find . --name *.tmp | xargs rm', 'Delete all .tmp files'],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );

        const searchPath = this.parseSearchPath(command) || fs.getCurrentDirectory();
        const typeFilter = command.args['type'] || null;
        const maxDepthArg = command.args['maxdepth'];
        const parsedDepth = parseInt(String(maxDepthArg ?? ''), 10);
        const maxDepth =
            maxDepthArg != null && maxDepthArg !== true && !isNaN(parsedDepth)
                ? parsedDepth
                : Infinity;

        try {
            const node = fs.getNode(searchPath);
            if (!node) {
                context.writer.writeError(
                    `find: '${searchPath}': No such file or directory`,
                );
                return;
            }
            const resolvedBase = fs.resolvePath(searchPath);
            const nameRegex = this.nameRegex(command);

            const results: string[] = [];
            this.fs = fs;

            // The start path is at depth 0, as in GNU find
            const baseName = resolvedBase.split('/').filter(Boolean).pop() ?? '/';
            if (this.matches(baseName, node.type, nameRegex, typeFilter)) {
                results.push(resolvedBase);
            }
            if (node.type === 'directory' && maxDepth > 0) {
                this.walk(
                    node,
                    resolvedBase,
                    1,
                    maxDepth,
                    nameRegex,
                    typeFilter,
                    results,
                );
            }

            for (const r of results) {
                context.writer.writeln(r);
            }
        } catch (e: any) {
            context.writer.writeError(`find: ${e.message}`);
        }
    }

    /** `--name` matches case-sensitively, `--iname` ignoring case. */
    private nameRegex(command: CliProcessCommand): RegExp | null {
        const name = command.args['name'];
        if (name != null && name !== true) {
            return this.globToRegex(String(name), false);
        }
        const iname = command.args['iname'];
        if (iname != null && iname !== true) {
            return this.globToRegex(String(iname), true);
        }
        return null;
    }

    private matches(
        name: string,
        type: string,
        nameRegex: RegExp | null,
        typeFilter: string | null,
    ): boolean {
        if (nameRegex && !nameRegex.test(name)) return false;
        if (typeFilter === 'f' && type !== 'file') return false;
        if (typeFilter === 'd' && type !== 'directory') return false;
        return true;
    }

    private parseSearchPath(command: CliProcessCommand): string | null {
        const raw = command.value || '';
        const tokens = splitArgs(raw).filter(Boolean);
        return tokens.length > 0 ? tokens[0] : null;
    }

    private globToRegex(pattern: string, ignoreCase: boolean): RegExp {
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        const regexStr = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
        return new RegExp(`^${regexStr}$`, ignoreCase ? 'i' : '');
    }

    /** File system of the running command (listing goes through access checks) */
    private fs?: IFileSystemService;

    /** Lists the children of `node`, which are at `depth` (1 = direct children). */
    private walk(
        node: IFileNode,
        currentPath: string,
        depth: number,
        maxDepth: number,
        nameRegex: RegExp | null,
        typeFilter: string | null,
        results: string[],
    ): void {
        const children = this.fs ? readableChildren(this.fs, currentPath) : node.children;
        if (!children) return;

        for (const child of children) {
            const childPath =
                currentPath === '/'
                    ? `/${child.name}`
                    : `${currentPath}/${child.name}`;

            if (this.matches(child.name, child.type, nameRegex, typeFilter)) {
                results.push(childPath);
            }

            if (child.type === 'directory' && depth < maxDepth) {
                this.walk(
                    child,
                    childPath,
                    depth + 1,
                    maxDepth,
                    nameRegex,
                    typeFilter,
                    results,
                );
            }
        }
    }
}

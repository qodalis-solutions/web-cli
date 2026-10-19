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
import { IFileNode } from '../interfaces/i-file-node';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliDuCommandProcessor implements ICliCommandProcessor {
    command = 'du';
    description = 'Estimate file space usage';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    metadata = { icon: '📏', module: 'file management' };

    parameters = [
        {
            name: 'h',
            description: 'Human-readable sizes (e.g. 1K, 2M)',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 's',
            description: 'Display only a total for each argument',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'max-depth',
            aliases: ['d'],
            description: 'Print total for a directory only if it is N or fewer levels below the argument',
            required: false,
            type: 'number' as const,
        },
    ];

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'Show how much space files and directories use, in bytes. For a directory, every subdirectory is listed with its total size; use -s for just the total or -d to limit how deep it goes.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['du [path...]', 'Sizes of a path (default: the current directory) and its subdirectories'],
            ['du -s <path>', 'Only the total'],
            ['du -d <n> <path>', 'Only <n> levels deep'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['du ~/docs', 'Size of each directory in ~/docs'],
            ['du -h -s ~', 'Total of your home in K/M/G'],
            ['du -h -d 1 .', 'Size of each top-level folder'],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const { humanReadable, summaryOnly, maxDepth, paths } =
            this.parseArgs(command);

        if (paths.length === 0) {
            paths.push(fs.getCurrentDirectory());
        }

        for (const path of paths) {
            const resolved = fs.resolvePath(path);
            if (fs.canTraverse && !fs.canTraverse(resolved)) {
                context.writer.writeError(`du: cannot access '${path}': Permission denied`);
                continue;
            }
            const node = fs.getNode(resolved);

            if (!node) {
                context.writer.writeError(
                    `du: cannot access '${path}': No such file or directory`,
                );
                continue;
            }

            if (node.type === 'file') {
                context.writer.writeln(
                    `${this.formatSize(node.size, humanReadable)}\t${resolved}`,
                );
            } else {
                const entries: { size: number; path: string }[] = [];
                this.fs = fs;
                this.collectSizes(node, resolved, 0, maxDepth, summaryOnly, entries);

                for (const entry of entries) {
                    context.writer.writeln(
                        `${this.formatSize(entry.size, humanReadable)}\t${entry.path}`,
                    );
                }
            }
        }
    }

    private parseArgs(command: CliProcessCommand): {
        humanReadable: boolean;
        summaryOnly: boolean;
        maxDepth: number;
        paths: string[];
    } {
        const raw = command.value || '';
        const paths = splitArgs(raw).filter(Boolean);
        const humanReadable = !!command.args['h'];
        const summaryOnly = !!command.args['s'];
        const depthArg = command.args['max-depth'] ?? command.args['d'];
        const parsedDepth = parseInt(String(depthArg ?? ''), 10);
        const maxDepth =
            depthArg != null && depthArg !== true && !isNaN(parsedDepth)
                ? parsedDepth
                : Infinity;

        return { humanReadable, summaryOnly, maxDepth, paths };
    }

    /** File system of the running command (listing goes through access checks) */
    private fs?: IFileSystemService;

    private collectSizes(
        node: IFileNode,
        path: string,
        depth: number,
        maxDepth: number,
        summaryOnly: boolean,
        entries: { size: number; path: string }[],
    ): number {
        if (node.type === 'file') {
            return node.size;
        }

        let total = 0;
        const children = this.fs ? readableChildren(this.fs, path) : node.children;
        if (children) {
            for (const child of children) {
                const childPath = path === '/' ? `/${child.name}` : `${path}/${child.name}`;
                total += this.collectSizes(
                    child,
                    childPath,
                    depth + 1,
                    maxDepth,
                    summaryOnly,
                    entries,
                );
            }
        }

        if (summaryOnly) {
            if (depth === 0) {
                entries.push({ size: total, path });
            }
        } else if (depth <= maxDepth) {
            entries.push({ size: total, path });
        }

        return total;
    }

    private formatSize(bytes: number, humanReadable: boolean): string {
        if (!humanReadable) {
            return String(bytes);
        }

        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
        if (bytes < 1024 * 1024 * 1024)
            return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
    }
}

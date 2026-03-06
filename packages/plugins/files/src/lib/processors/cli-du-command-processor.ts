import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
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
    valueRequired = true;
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

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const { humanReadable, summaryOnly, maxDepth, paths } =
            this.parseArgs(command);

        if (paths.length === 0) {
            context.writer.writeError('du: missing operand');
            return;
        }

        for (const path of paths) {
            const resolved = fs.resolvePath(path);
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
        const raw = command.rawCommand || '';
        const tokens = raw.split(/\s+/).filter(Boolean);
        let humanReadable = false;
        let summaryOnly = false;
        let maxDepth = Infinity;
        const paths: string[] = [];

        let i = 0;
        while (i < tokens.length) {
            const t = tokens[i];
            if (t === '-h') {
                humanReadable = true;
                i++;
            } else if (t === '-s') {
                summaryOnly = true;
                i++;
            } else if (t === '-d' || t === '--max-depth') {
                maxDepth = parseInt(tokens[i + 1] || '0', 10);
                i += 2;
            } else if (t === '-sh' || t === '-hs') {
                summaryOnly = true;
                humanReadable = true;
                i++;
            } else if (t.startsWith('-')) {
                // Handle combined flags like -sh
                if (t.includes('s')) summaryOnly = true;
                if (t.includes('h')) humanReadable = true;
                i++;
            } else {
                paths.push(t);
                i++;
            }
        }

        return { humanReadable, summaryOnly, maxDepth, paths };
    }

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
        if (node.children) {
            for (const child of node.children) {
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

import {
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
            description: 'Match filename pattern (glob: * and ? supported)',
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
            description: 'Maximum directory depth to search',
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

        const searchPath = this.parseSearchPath(command) || fs.getCurrentDirectory();
        const namePattern = command.args['name'] || null;
        const typeFilter = command.args['type'] || null;
        const maxDepth = command.args['maxdepth']
            ? parseInt(command.args['maxdepth'], 10)
            : Infinity;

        try {
            const node = fs.getNode(searchPath);
            if (!node) {
                context.writer.writeError(
                    `find: '${searchPath}': No such file or directory`,
                );
                return;
            }
            if (node.type !== 'directory') {
                context.writer.writeError(
                    `find: '${searchPath}': Not a directory`,
                );
                return;
            }

            const resolvedBase = fs.resolvePath(searchPath);
            const nameRegex = namePattern ? this.globToRegex(namePattern) : null;

            const results: string[] = [];
            this.walk(
                node,
                resolvedBase,
                0,
                maxDepth,
                nameRegex,
                typeFilter,
                results,
            );

            for (const r of results) {
                context.writer.writeln(r);
            }
        } catch (e: any) {
            context.writer.writeError(`find: ${e.message}`);
        }
    }

    private parseSearchPath(command: CliProcessCommand): string | null {
        const raw = command.value || '';
        const tokens = raw.split(/\s+/).filter(Boolean);
        return tokens.length > 0 ? tokens[0] : null;
    }

    private globToRegex(pattern: string): RegExp {
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        const regexStr = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
        return new RegExp(`^${regexStr}$`, 'i');
    }

    private walk(
        node: IFileNode,
        currentPath: string,
        depth: number,
        maxDepth: number,
        nameRegex: RegExp | null,
        typeFilter: string | null,
        results: string[],
    ): void {
        if (!node.children) return;

        for (const child of node.children) {
            const childPath =
                currentPath === '/'
                    ? `/${child.name}`
                    : `${currentPath}/${child.name}`;

            let matches = true;
            if (nameRegex && !nameRegex.test(child.name)) {
                matches = false;
            }
            if (typeFilter === 'f' && child.type !== 'file') {
                matches = false;
            }
            if (typeFilter === 'd' && child.type !== 'directory') {
                matches = false;
            }

            if (matches) {
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

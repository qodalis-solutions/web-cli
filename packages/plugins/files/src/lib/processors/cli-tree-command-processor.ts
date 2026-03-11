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

export class CliTreeCommandProcessor implements ICliCommandProcessor {
    command = 'tree';
    description = 'Display directory tree structure';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    metadata = { icon: '🌳', module: 'file management' };

    parameters = [
        {
            name: 'depth',
            aliases: ['L'],
            description: 'Max display depth of the directory tree',
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
        const targetPath = command.value || fs.getCurrentDirectory();
        const maxDepth = command.args['depth']
            ? parseInt(command.args['depth'])
            : command.args['L']
              ? parseInt(command.args['L'])
              : Infinity;

        try {
            const node = fs.getNode(targetPath);
            if (!node) {
                context.writer.writeError(
                    `tree: ${targetPath}: No such file or directory`,
                );
                return;
            }
            if (node.type !== 'directory') {
                context.writer.writeError(
                    `tree: ${targetPath}: Not a directory`,
                );
                return;
            }

            const resolvedPath = fs.resolvePath(targetPath);
            context.writer.writeln(
                context.writer.wrapInColor(
                    resolvedPath,
                    CliForegroundColor.Cyan,
                ),
            );

            const counts = { dirs: 0, files: 0 };
            this.printTree(node, '', true, 0, maxDepth, context, counts);

            context.writer.writeln();
            context.writer.writeln(
                `${counts.dirs} directories, ${counts.files} files`,
            );
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }

    private printTree(
        node: IFileNode,
        prefix: string,
        isRoot: boolean,
        depth: number,
        maxDepth: number,
        context: ICliExecutionContext,
        counts: { dirs: number; files: number },
    ): void {
        if (!node.children || depth >= maxDepth) {
            return;
        }

        const children = [...node.children].sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const isLast = i === children.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const childPrefix = isLast ? '    ' : '│   ';

            const displayName =
                child.type === 'directory'
                    ? context.writer.wrapInColor(
                          child.name,
                          CliForegroundColor.Cyan,
                      )
                    : child.name;

            context.writer.writeln(`${prefix}${connector}${displayName}`);

            if (child.type === 'directory') {
                counts.dirs++;
                this.printTree(
                    child,
                    prefix + childPrefix,
                    false,
                    depth + 1,
                    maxDepth,
                    context,
                    counts,
                );
            } else {
                counts.files++;
            }
        }
    }
}

import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    writeExamples,
    writeUsage,
    writeWrapped,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliStatCommandProcessor implements ICliCommandProcessor {
    command = 'stat';
    description = 'Display file/directory metadata';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '📊', module: 'file management' };

    parameters = [];

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'Show details about files or directories: full path, size, type, permissions, owner, group, and when it was created and last modified.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['stat <path...>', 'Show details for each path'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['stat notes.txt', 'Details of one file'],
            ['stat ~/docs notes.txt', 'Several paths at once'],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const paths = this.parsePaths(command);

        if (paths.length === 0) {
            context.writer.writeError('stat: missing operand');
            return;
        }

        for (const path of paths) {
            const resolved = fs.resolvePath(path);
            if (fs.canTraverse && !fs.canTraverse(resolved)) {
                context.writer.writeError(`stat: cannot stat '${path}': Permission denied`);
                continue;
            }
            const node = fs.getNode(resolved);

            if (!node) {
                context.writer.writeError(
                    `stat: cannot stat '${path}': No such file or directory`,
                );
                continue;
            }

            context.writer.writeKeyValue({
                File: resolved,
                Size: `${node.size}`,
                Type: node.type,
                Permissions: node.permissions || 'rw-r--r--',
                Owner: node.ownership?.uid || '-',
                Group: node.ownership?.gid || '-',
                Created: new Date(node.createdAt).toLocaleString(),
                Modified: new Date(node.modifiedAt).toLocaleString(),
            });
        }
    }

    private parsePaths(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return raw.split(/\s+/).filter(Boolean);
    }
}

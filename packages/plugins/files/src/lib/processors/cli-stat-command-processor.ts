import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
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

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const paths = this.parsePaths(command);

        if (paths.length === 0) {
            context.writer.writeError('stat: missing operand');
            return;
        }

        for (const path of paths) {
            const resolved = fs.resolvePath(path);
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
        const raw = command.rawCommand || '';
        const tokens = raw.split(/\s+/).filter(Boolean);
        const paths: string[] = [];
        for (const t of tokens) {
            if (!t.startsWith('-')) {
                paths.push(t);
            }
        }
        return paths;
    }
}

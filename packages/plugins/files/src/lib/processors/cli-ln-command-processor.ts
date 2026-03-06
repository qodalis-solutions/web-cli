import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliLnCommandProcessor implements ICliCommandProcessor {
    command = 'ln';
    description = 'Create symbolic links';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '🔗', module: 'file management' };

    parameters = [
        {
            name: 's',
            description: 'Create a symbolic link',
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
        const { symbolic, target, linkName } = this.parseArgs(command);

        if (!symbolic) {
            context.writer.writeError(
                'ln: hard links not supported in virtual filesystem',
            );
            return;
        }

        if (!target || !linkName) {
            context.writer.writeError('ln: missing operand');
            return;
        }

        const resolvedLink = fs.resolvePath(linkName);
        const resolvedTarget = fs.resolvePath(target);

        // Check if the link already exists
        if (fs.exists(resolvedLink)) {
            context.writer.writeError(
                `ln: failed to create symbolic link '${linkName}': File exists`,
            );
            return;
        }

        // Create the symlink as a file node with linkTarget set
        // We allow dangling symlinks so we don't check if target exists
        fs.createFile(resolvedLink, '');
        const node = fs.getNode(resolvedLink);
        if (node) {
            node.linkTarget = resolvedTarget;
            node.size = 0;
        }

        await fs.persist();
    }

    private parseArgs(command: CliProcessCommand): {
        symbolic: boolean;
        target: string | null;
        linkName: string | null;
    } {
        const raw = command.rawCommand || '';
        const tokens = raw.split(/\s+/).filter(Boolean);
        let symbolic = false;
        const positional: string[] = [];

        for (const t of tokens) {
            if (t === '-s') {
                symbolic = true;
            } else if (!t.startsWith('-')) {
                positional.push(t);
            }
        }

        return {
            symbolic,
            target: positional[0] || null,
            linkName: positional[1] || null,
        };
    }
}

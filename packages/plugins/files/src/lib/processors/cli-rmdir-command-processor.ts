import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliRmdirCommandProcessor implements ICliCommandProcessor {
    command = 'rmdir';
    description = 'Remove empty directories';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '🗑', module: 'file management' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const path = command.value;

        if (!path) {
            context.writer.writeError('rmdir: missing operand');
            return;
        }

        try {
            const node = fs.getNode(path);
            if (!node) {
                context.writer.writeError(
                    `rmdir: ${path}: No such file or directory`,
                );
                return;
            }
            if (node.type !== 'directory') {
                context.writer.writeError(`rmdir: ${path}: Not a directory`);
                return;
            }
            if (node.children && node.children.length > 0) {
                context.writer.writeError(
                    `rmdir: ${path}: Directory not empty`,
                );
                return;
            }
            fs.remove(path);
            await fs.persist();
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }
}

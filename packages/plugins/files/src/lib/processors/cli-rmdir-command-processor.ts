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
import { splitArgs } from '../utils/split-args';
import { LIBRARY_VERSION } from '../version';

export class CliRmdirCommandProcessor implements ICliCommandProcessor {
    command = 'rmdir';
    description = 'Remove empty directories';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '🗑', module: 'file management' };

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'Remove an empty directory. It refuses to remove a directory that still contains files; use rm -r for that.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['rmdir <dir...>', 'Remove empty directories'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['rmdir empty-folder', 'Remove a directory in the current one'],
            ['rmdir ~/docs/old', 'Remove by full path'],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const paths = splitArgs(command.value || '');

        if (paths.length === 0) {
            context.writer.writeError('rmdir: missing operand');
            return;
        }

        let changed = false;
        for (const path of paths) {
            try {
                const node = fs.getNode(path);
                if (!node) {
                    context.writer.writeError(
                        `rmdir: ${path}: No such file or directory`,
                    );
                    continue;
                }
                if (node.type !== 'directory') {
                    context.writer.writeError(`rmdir: ${path}: Not a directory`);
                    continue;
                }
                if (node.children && node.children.length > 0) {
                    context.writer.writeError(
                        `rmdir: ${path}: Directory not empty`,
                    );
                    continue;
                }
                // Checked empty above; the service removes directories only recursively
                fs.remove(path, true);
                changed = true;
            } catch (e: any) {
                context.writer.writeError(e.message);
            }
        }
        if (changed) await fs.persist();
    }
}

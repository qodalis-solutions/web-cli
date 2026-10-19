import { splitArgs } from '../utils/split-args';
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

export class CliMvCommandProcessor implements ICliCommandProcessor {
    command = 'mv';
    description = 'Move or rename files and directories';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    metadata = { icon: '📦', module: 'file management' };

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.mv.help.move_rename_file_directory', 'Move or rename a file or directory. If the destination is an existing directory, the source is moved into it; otherwise it is renamed. A file already at the destination is replaced.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['mv <source> <dest>', t.t('cli.mv.help.rename_file_directory', 'Rename a file or directory')],
            ['mv <source...> <dir>', t.t('cli.mv.help.move_them_directory', 'Move them into a directory')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['mv draft.txt final.txt', t.t('cli.mv.help.rename_file', 'Rename a file')],
            ['mv final.txt ~/docs', t.t('cli.mv.help.move_docs', 'Move it into ~/docs')],
            ['mv old-dir new-dir', t.t('cli.mv.help.rename_directory', 'Rename a directory')],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );

        const parts = this.parseArgs(command);

        if (parts.length < 2) {
            context.writer.writeError('mv: missing destination file operand');
            context.writer.writeln('Usage: mv <source> <destination>');
            return;
        }

        // Several sources go into the last operand, which must be a directory
        const dest = parts[parts.length - 1];
        const sources = parts.slice(0, -1);
        if (sources.length > 1 && !fs.isDirectory(dest)) {
            context.writer.writeError(`mv: target '${dest}' is not a directory`);
            return;
        }

        let changed = false;
        for (const src of sources) {
            try {
                fs.move(src, dest);
                changed = true;
            } catch (e: any) {
                context.writer.writeError(e.message);
            }
        }
        if (changed) await fs.persist();
    }

    private parseArgs(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        // Flags never reach the value, so a quoted `-name` is a file
        return splitArgs(raw).filter(Boolean);
    }
}

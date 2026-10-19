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

export class CliTouchCommandProcessor implements ICliCommandProcessor {
    command = 'touch';
    description = 'Create an empty file or update its timestamp';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '📄', module: 'file management' };

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.touch.help.create_empty_file_update', 'Create an empty file, or update the modified time of a file that already exists. The parent directory must already exist.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['touch <file...>', t.t('cli.touch.help.create_files_refresh_their', 'Create the files, or refresh their timestamps')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['touch notes.txt', t.t('cli.touch.help.create_empty_notes_txt', 'Create an empty notes.txt')],
            ['touch ~/docs/todo.md', t.t('cli.touch.help.create_file_docs', 'Create a file in ~/docs')],
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
            context.writer.writeError('touch: missing file operand');
            return;
        }

        let changed = false;
        for (const path of paths) {
            try {
                fs.createFile(path);
                changed = true;
            } catch (e: any) {
                context.writer.writeError(e.message);
            }
        }
        if (changed) await fs.persist();
    }
}

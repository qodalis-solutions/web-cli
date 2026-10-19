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

export class CliRmCommandProcessor implements ICliCommandProcessor {
    command = 'rm';
    description = 'Remove files or directories';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '🗑', module: 'file management' };

    parameters = [
        {
            name: 'recursive',
            aliases: ['r', 'R'],
            description: 'Remove directories and their contents recursively',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'force',
            aliases: ['f'],
            description: 'Ignore nonexistent files, never prompt',
            required: false,
            type: 'boolean' as const,
        },
    ];

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.rm.help.delete_file_directories_only', 'Delete a file. Directories are only removed with -r, which deletes everything inside them. Deleted files cannot be recovered.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['rm <file...>', t.t('cli.rm.help.delete_one_more_files', 'Delete one or more files')],
            ['rm -r <dir>', t.t('cli.rm.help.delete_directory_contents', 'Delete a directory and its contents')],
            ['rm -f <file>', t.t('cli.rm.help.delete_without_error_if', 'Delete without an error if it is missing')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['rm notes.bak', t.t('cli.rm.help.delete_one_file', 'Delete one file')],
            ['rm -r old-project', t.t('cli.rm.help.delete_whole_directory', 'Delete a whole directory')],
            ['rm -f maybe.txt', t.t('cli.rm.help.quiet_if_file_does', 'Quiet if the file does not exist')],
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
        const recursive =
            command.args['recursive'] || command.args['r'] || command.args['R'];
        const force = command.args['force'] || command.args['f'];

        if (paths.length === 0) {
            if (!force) context.writer.writeError('rm: missing operand');
            return;
        }

        let changed = false;
        for (const path of paths) {
            try {
                if (!fs.exists(path)) {
                    if (!force) {
                        context.writer.writeError(
                            `rm: ${path}: No such file or directory`,
                        );
                    }
                    continue;
                }

                if (fs.isDirectory(path) && !recursive) {
                    context.writer.writeError(`rm: ${path}: Is a directory`);
                    continue;
                }

                fs.remove(path, recursive);
                changed = true;
            } catch (e: any) {
                context.writer.writeError(e.message);
            }
        }
        if (changed) await fs.persist();
    }
}

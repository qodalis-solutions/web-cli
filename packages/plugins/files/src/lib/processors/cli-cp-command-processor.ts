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

export class CliCpCommandProcessor implements ICliCommandProcessor {
    command = 'cp';
    description = 'Copy files and directories';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    metadata = { icon: '📋', module: 'file management' };

    parameters = [
        {
            name: 'recursive',
            aliases: ['r', 'R'],
            description: 'Copy directories recursively',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'force',
            aliases: ['f'],
            description: 'Overwrite existing files (always done; accepted for -rf)',
            required: false,
            type: 'boolean' as const,
        },
    ];

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.cp.help.copy_file_new_path', 'Copy a file to a new path, or into an existing directory. Copying a directory needs -r, which copies everything inside it. A file already at the destination is replaced.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['cp <source> <dest>', t.t('cli.cp.help.copy_file_new_name', 'Copy a file to a new name')],
            ['cp <source...> <dir>', t.t('cli.cp.help.copy_files_directory', 'Copy files into a directory')],
            ['cp -r <dir> <dest>', t.t('cli.cp.help.copy_directory_contents', 'Copy a directory and its contents')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['cp notes.txt notes.bak', t.t('cli.cp.help.make_backup_copy', 'Make a backup copy')],
            ['cp report.txt ~/docs', t.t('cli.cp.help.copy_docs', 'Copy into ~/docs')],
            ['cp -r project project-copy', t.t('cli.cp.help.duplicate_whole_directory', 'Duplicate a whole directory')],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const recursive =
            command.args['recursive'] || command.args['r'] || command.args['R'];

        const parts = this.parseArgs(command);

        if (parts.length < 2) {
            context.writer.writeError('cp: missing destination file operand');
            context.writer.writeln(
                'Usage: cp [--recursive] <source> <destination>',
            );
            return;
        }

        // Several sources go into the last operand, which must be a directory
        const dest = parts[parts.length - 1];
        const sources = parts.slice(0, -1);
        if (sources.length > 1 && !fs.isDirectory(dest)) {
            context.writer.writeError(`cp: target '${dest}' is not a directory`);
            return;
        }

        let changed = false;
        for (const src of sources) {
            try {
                fs.copy(src, dest, recursive);
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

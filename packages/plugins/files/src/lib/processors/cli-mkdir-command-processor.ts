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

export class CliMkdirCommandProcessor implements ICliCommandProcessor {
    command = 'mkdir';
    description = 'Create directories';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '📁', module: 'file management' };

    parameters = [
        {
            name: 'parents',
            aliases: ['p'],
            description: 'Create parent directories as needed',
            required: false,
            type: 'boolean' as const,
        },
    ];

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.mkdir.help.create_new_directory_p', 'Create a new directory. With -p, any missing parent directories are created too.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['mkdir <dir...>', t.t('cli.mkdir.help.create_one_more_directories', 'Create one or more directories')],
            ['mkdir -p <path>', t.t('cli.mkdir.help.create_directory_missing_parents', 'Create a directory and its missing parents')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['mkdir projects', t.t('cli.mkdir.help.create_projects_current_directory', 'Create projects in the current directory')],
            ['mkdir -p ~/docs/2026/notes', t.t('cli.mkdir.help.create_whole_path_once', 'Create the whole path at once')],
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
        const recursive = command.args['parents'] || command.args['p'];

        if (paths.length === 0) {
            context.writer.writeError('mkdir: missing operand');
            return;
        }

        let changed = false;
        for (const path of paths) {
            try {
                if (recursive && fs.isDirectory(path)) continue;
                fs.createDirectory(path, recursive);
                changed = true;
            } catch (e: any) {
                context.writer.writeError(e.message);
            }
        }
        if (changed) await fs.persist();
    }
}

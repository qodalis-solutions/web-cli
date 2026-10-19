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
        writeWrapped(
            context,
            'Delete a file. Directories are only removed with -r, which deletes everything inside them. Deleted files cannot be recovered.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['rm <file>', 'Delete a file'],
            ['rm -r <dir>', 'Delete a directory and its contents'],
            ['rm -f <file>', 'Delete without an error if it is missing'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['rm notes.bak', 'Delete one file'],
            ['rm -r old-project', 'Delete a whole directory'],
            ['rm -f maybe.txt', 'Quiet if the file does not exist'],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const path = command.value;
        const recursive =
            command.args['recursive'] || command.args['r'] || command.args['R'];
        const force = command.args['force'] || command.args['f'];

        if (!path) {
            context.writer.writeError('rm: missing operand');
            return;
        }

        try {
            if (!fs.exists(path)) {
                if (!force) {
                    context.writer.writeError(
                        `rm: ${path}: No such file or directory`,
                    );
                }
                return;
            }

            if (fs.isDirectory(path) && !recursive) {
                context.writer.writeError(`rm: ${path}: Is a directory`);
                return;
            }

            fs.remove(path, recursive);
            await fs.persist();
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }
}

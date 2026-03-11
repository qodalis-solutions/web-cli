import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
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

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
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

import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
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

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const path = command.value;
        const recursive = command.args['parents'] || command.args['p'];

        if (!path) {
            context.writer.writeError('mkdir: missing operand');
            return;
        }

        try {
            fs.createDirectory(path, recursive);
            await fs.persist();
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }
}

import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
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
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
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

        const src = parts[0];
        const dest = parts[1];

        try {
            fs.copy(src, dest, recursive);
            await fs.persist();
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }

    private parseArgs(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return raw.split(/\s+/).filter((t) => t && !t.startsWith('--') && !t.startsWith('-'));
    }
}

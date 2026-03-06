import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
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

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );

        const parts = this.parseArgs(command);

        if (parts.length < 2) {
            context.writer.writeError('mv: missing destination file operand');
            context.writer.writeln('Usage: mv <source> <destination>');
            return;
        }

        const src = parts[0];
        const dest = parts[1];

        try {
            fs.move(src, dest);
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

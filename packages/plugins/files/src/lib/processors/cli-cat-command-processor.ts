import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliCatCommandProcessor implements ICliCommandProcessor {
    command = 'cat';
    description = 'Display file contents';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '📖', module: 'file management' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const path = command.value;

        if (!path) {
            context.writer.writeError('cat: missing file operand');
            return;
        }

        try {
            const content = fs.readFile(path);
            if (content !== null) {
                context.writer.writeln(content);
            }
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }
}

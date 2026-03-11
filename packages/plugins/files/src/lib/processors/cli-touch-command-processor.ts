import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliTouchCommandProcessor implements ICliCommandProcessor {
    command = 'touch';
    description = 'Create an empty file or update its timestamp';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '📄', module: 'file management' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const path = command.value;

        if (!path) {
            context.writer.writeError('touch: missing file operand');
            return;
        }

        try {
            fs.createFile(path);
            await fs.persist();
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }
}

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

export class CliTouchCommandProcessor implements ICliCommandProcessor {
    command = 'touch';
    description = 'Create an empty file or update its timestamp';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '📄', module: 'file management' };

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'Create an empty file, or update the modified time of a file that already exists. The parent directory must already exist.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['touch <file>', 'Create the file, or refresh its timestamp'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['touch notes.txt', 'Create an empty notes.txt'],
            ['touch ~/docs/todo.md', 'Create a file in ~/docs'],
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

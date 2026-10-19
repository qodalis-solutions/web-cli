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

export class CliCatCommandProcessor implements ICliCommandProcessor {
    command = 'cat';
    description = 'Display file contents';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '📖', module: 'file management' };

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'Print the contents of a file to the terminal. Pipe the output into other commands to search, sort or count it.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['cat <file>', 'Print a file'],
            ['cat <file> | <command>', 'Send a file to another command'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['cat notes.txt', 'Show the whole file'],
            ['cat app.log | grep error', 'Show only lines with error'],
            ['cat names.txt | sort', 'Print the lines sorted'],
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

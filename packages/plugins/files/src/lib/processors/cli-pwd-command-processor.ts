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

export class CliPwdCommandProcessor implements ICliCommandProcessor {
    command = 'pwd';
    description = 'Print the current working directory';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    metadata = { icon: '📂', module: 'file management' };

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'Print the full path of the directory you are in. Relative paths in other commands start from here.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['pwd', 'Show the current directory'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['pwd', 'For example /home/user'],
            ['cd ~/docs; pwd', 'Prints /home/user/docs'],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        context.writer.writeln(fs.getCurrentDirectory());
    }
}

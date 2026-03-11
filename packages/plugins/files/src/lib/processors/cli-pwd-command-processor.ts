import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliPwdCommandProcessor implements ICliCommandProcessor {
    command = 'pwd';
    description = 'Print the current working directory';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    metadata = { icon: '📂', module: 'file management' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        context.writer.writeln(fs.getCurrentDirectory());
    }
}

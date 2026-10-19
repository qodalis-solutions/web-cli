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
import { splitArgs } from '../utils/split-args';

export class CliCdCommandProcessor implements ICliCommandProcessor {
    command = 'cd';
    description = 'Change the current working directory';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    metadata = { icon: '📁', module: 'file management' };

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'Change the current directory. Without a path it goes to your home directory. Paths can be absolute (/...), relative to where you are, or start with ~ for home.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['cd', 'Go to your home directory'],
            ['cd <dir>', 'Go into a directory'],
            ['cd ..', 'Go up one level'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['cd ~/docs', 'Go to docs in your home'],
            ['cd ../projects', 'Go to a sibling directory'],
            ['cd /', 'Go to the root'],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const target = splitArgs(command.value || '').join(' ') || '~';

        try {
            fs.setCurrentDirectory(target);
            await fs.persist();
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }
}

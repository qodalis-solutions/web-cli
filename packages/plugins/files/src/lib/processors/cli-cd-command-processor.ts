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
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.cd.help.change_current_directory_without', 'Change the current directory. Without a path it goes to your home directory. Paths can be absolute (/...), relative to where you are, or start with ~ for home.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['cd', t.t('cli.cd.help.go_home_directory', 'Go to your home directory')],
            ['cd <dir>', t.t('cli.cd.help.go_directory', 'Go into a directory')],
            ['cd ..', t.t('cli.cd.help.go_up_one_level', 'Go up one level')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['cd ~/docs', t.t('cli.cd.help.go_docs_home', 'Go to docs in your home')],
            ['cd ../projects', t.t('cli.cd.help.go_sibling_directory', 'Go to a sibling directory')],
            ['cd /', t.t('cli.cd.help.go_root', 'Go to the root')],
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

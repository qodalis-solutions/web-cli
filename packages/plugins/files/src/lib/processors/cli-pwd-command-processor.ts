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
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.pwd.help.print_full_path_directory', 'Print the full path of the directory you are in. Relative paths in other commands start from here.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['pwd', t.t('cli.pwd.help.show_current_directory', 'Show the current directory')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['pwd', t.t('cli.pwd.help.example_home_user', 'For example /home/user')],
            ['cd ~/docs; pwd', t.t('cli.pwd.help.prints_home_user_docs', 'Prints /home/user/docs')],
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

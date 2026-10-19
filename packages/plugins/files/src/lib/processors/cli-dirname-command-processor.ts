import { splitArgs } from '../utils/split-args';
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    writeExamples,
    writeUsage,
    writeWrapped,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

export class CliDirnameCommandProcessor implements ICliCommandProcessor {
    command = 'dirname';
    description = 'Strip last component from path';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '📂', module: 'file management' };

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.dirname.help.print_directory_part_path', 'Print the directory part of a path, everything before the last /. A bare name with no / gives . (the current directory).'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['dirname <path>', t.t('cli.dirname.help.path_without_last_part', 'Path without its last part')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['dirname /home/user/notes.txt', t.t('cli.dirname.help.prints_home_user', 'Prints /home/user')],
            ['dirname notes.txt', t.t('cli.dirname.help.prints', 'Prints .')],
            ['dirname /home', t.t('cli.dirname.help.prints_2', 'Prints /')],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const tokens = this.parseTokens(command);

        if (tokens.length === 0) {
            context.writer.writeError('dirname: missing operand');
            return;
        }

        const path = tokens[0];

        // Handle root path
        if (path === '/') {
            context.writer.writeln('/');
            return;
        }

        // Remove trailing slashes
        const cleaned = path.replace(/\/+$/, '') || '/';

        // No slash at all => bare filename => return '.'
        if (!cleaned.includes('/')) {
            context.writer.writeln('.');
            return;
        }

        const parts = cleaned.split('/');
        parts.pop(); // remove last component

        let dir = parts.join('/');
        // If dir is empty after removing last component (e.g. "/home" -> "")
        if (!dir) {
            dir = '/';
        }

        context.writer.writeln(dir);
    }

    private parseTokens(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return splitArgs(raw).filter(Boolean);
    }
}

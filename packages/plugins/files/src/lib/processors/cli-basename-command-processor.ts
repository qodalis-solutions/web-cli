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

export class CliBasenameCommandProcessor implements ICliCommandProcessor {
    command = 'basename';
    description = 'Strip directory from path';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '📛', module: 'file management' };

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.basename.help.print_last_part_path', 'Print the last part of a path, the file or directory name, without the directories in front. If a suffix is given, it is removed from the end too.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['basename <path>', t.t('cli.basename.help.name_without_directories', 'Name without the directories')],
            ['basename <path> <suffix>', t.t('cli.basename.help.also_remove_trailing_suffix', 'Also remove a trailing suffix')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['basename /home/user/notes.txt', t.t('cli.basename.help.prints_notes_txt', 'Prints notes.txt')],
            ['basename /home/user/notes.txt .txt', t.t('cli.basename.help.prints_notes', 'Prints notes')],
            ['basename /home/user/', t.t('cli.basename.help.prints_user', 'Prints user')],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const tokens = this.parseTokens(command);

        if (tokens.length === 0) {
            context.writer.writeError('basename: missing operand');
            return;
        }

        const path = tokens[0];
        const suffix = tokens.length > 1 ? tokens[1] : undefined;

        // Handle root path
        if (path === '/') {
            context.writer.writeln('/');
            return;
        }

        // Remove trailing slashes
        const cleaned = path.replace(/\/+$/, '') || '/';
        const parts = cleaned.split('/');
        let name = parts[parts.length - 1];

        // If after cleaning we got empty (shouldn't happen), fallback
        if (!name) {
            name = '/';
        }

        // Strip suffix if provided and name ends with it
        if (suffix && name.endsWith(suffix) && name !== suffix) {
            name = name.slice(0, -suffix.length);
        }

        context.writer.writeln(name);
    }

    private parseTokens(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return splitArgs(raw).filter(Boolean);
    }
}

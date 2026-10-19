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

export class CliTailCommandProcessor implements ICliCommandProcessor {
    command = 'tail';
    description = 'Display the last lines of a file';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '⬇️', module: 'file management' };

    parameters = [
        {
            name: 'lines',
            aliases: ['n'],
            description: 'Number of lines to display (default: 10)',
            required: false,
            type: 'number' as const,
        },
    ];

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'Print the last lines of a file, 10 by default. Works on piped input too. With several files, each one gets a ==> name <== header.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['tail <file>', 'Last 10 lines'],
            ['tail -n <count> <file>', 'Last <count> lines'],
            ['<command> | tail', 'Last lines of piped input'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['tail app.log', 'Show the end of a log'],
            ['tail -n 5 notes.txt', 'Last 5 lines'],
            ['cat app.log | tail -n 20', 'Last 20 lines of the log'],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const count = parseInt(
            command.args['lines'] || command.args['n'] || '10',
            10,
        );
        const paths = this.parsePaths(command);

        if (paths.length === 0) {
            if (command.data != null) {
                const content = typeof command.data === 'string'
                    ? command.data : JSON.stringify(command.data);
                const lines = content.split('\n');
                const selected = lines.slice(-count);
                context.writer.writeln(selected.join('\n'));
                return;
            }
            context.writer.writeError('tail: missing file operand');
            return;
        }

        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            try {
                if (fs.isDirectory(path)) {
                    context.writer.writeError(`tail: ${path}: Is a directory`);
                    continue;
                }
                const content = fs.readFile(path);
                if (content === null) continue;

                if (paths.length > 1) {
                    if (i > 0) context.writer.writeln();
                    context.writer.writeln(`==> ${path} <==`);
                }

                const lines = content.split('\n');
                const selected = lines.slice(-count);
                context.writer.writeln(selected.join('\n'));
            } catch (e: any) {
                context.writer.writeError(`tail: ${e.message}`);
            }
        }
    }

    private parsePaths(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return raw.split(/\s+/).filter(Boolean);
    }
}

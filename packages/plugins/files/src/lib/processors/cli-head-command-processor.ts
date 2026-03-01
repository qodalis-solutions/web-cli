import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliHeadCommandProcessor implements ICliCommandProcessor {
    command = 'head';
    description = 'Display the first lines of a file';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '⬆️', module: 'file management' };

    parameters = [
        {
            name: 'lines',
            aliases: ['n'],
            description: 'Number of lines to display (default: 10)',
            required: false,
            type: 'number' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const count = parseInt(
            command.args['lines'] || command.args['n'] || '10',
            10,
        );
        const paths = this.parsePaths(command);

        if (paths.length === 0) {
            context.writer.writeError('head: missing file operand');
            return;
        }

        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            try {
                if (fs.isDirectory(path)) {
                    context.writer.writeError(`head: ${path}: Is a directory`);
                    continue;
                }
                const content = fs.readFile(path);
                if (content === null) continue;

                if (paths.length > 1) {
                    if (i > 0) context.writer.writeln();
                    context.writer.writeln(`==> ${path} <==`);
                }

                const lines = content.split('\n');
                const selected = lines.slice(0, count);
                context.writer.writeln(selected.join('\n'));
            } catch (e: any) {
                context.writer.writeError(`head: ${e.message}`);
            }
        }
    }

    private parsePaths(command: CliProcessCommand): string[] {
        const raw = command.rawCommand || '';
        const tokens = raw.split(/\s+/).filter(Boolean);
        const paths: string[] = [];
        let i = 0;
        while (i < tokens.length) {
            const t = tokens[i];
            if (t === '-n' || t === '--lines') {
                i += 2; // skip flag and its value
            } else if (t.startsWith('-')) {
                i++;
            } else {
                paths.push(t);
                i++;
            }
        }
        return paths;
    }
}

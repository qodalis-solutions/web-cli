import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliTacCommandProcessor implements ICliCommandProcessor {
    command = 'tac';
    description = 'Print file in reverse line order';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '🔄', module: 'file management' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const paths = this.parsePaths(command);

        if (paths.length === 0) {
            if (command.data != null) {
                const content = typeof command.data === 'string'
                    ? command.data : JSON.stringify(command.data);
                const lines = content.split('\n');
                if (lines.length > 0 && lines[lines.length - 1] === '') {
                    lines.pop();
                }
                lines.reverse();
                context.writer.writeln(lines.join('\n'));
                return;
            }
            context.writer.writeError('tac: missing file operand');
            return;
        }

        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            try {
                if (fs.isDirectory(path)) {
                    context.writer.writeError(`tac: ${path}: Is a directory`);
                    continue;
                }
                const content = fs.readFile(path);
                if (content === null) continue;

                if (paths.length > 1) {
                    if (i > 0) context.writer.writeln();
                    context.writer.writeln(`==> ${path} <==`);
                }

                const lines = content.split('\n');
                // Filter trailing empty line from trailing newline
                if (lines.length > 0 && lines[lines.length - 1] === '') {
                    lines.pop();
                }
                lines.reverse();
                context.writer.writeln(lines.join('\n'));
            } catch (e: any) {
                context.writer.writeError(`tac: ${e.message}`);
            }
        }
    }

    private parsePaths(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return raw.split(/\s+/).filter(Boolean);
    }
}

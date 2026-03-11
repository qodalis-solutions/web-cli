import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliPasteCommandProcessor implements ICliCommandProcessor {
    command = 'paste';
    description = 'Merge lines of files side by side';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '\u{1F4CB}', module: 'file management' };

    parameters = [
        {
            name: 'delimiters',
            aliases: ['d'],
            description: 'Use a specific delimiter (default: tab)',
            required: false,
            type: 'string' as const,
        },
        {
            name: 'serial',
            aliases: ['s'],
            description:
                'Paste one file at a time instead of in parallel',
            required: false,
            type: 'boolean' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );

        const delimiter = command.args['d'] || command.args['delimiters'] || '\t';
        const serial = !!command.args['s'] || !!command.args['serial'];

        const paths = this.parsePaths(command);

        if (paths.length === 0) {
            context.writer.writeError('paste: missing file operand');
            return;
        }

        if (!serial && paths.length < 2) {
            context.writer.writeError('paste: missing file operand');
            return;
        }

        // Read all files
        const fileLines: string[][] = [];
        for (const path of paths) {
            try {
                if (fs.isDirectory(path)) {
                    context.writer.writeError(
                        `paste: ${path}: Is a directory`,
                    );
                    return;
                }
                const content = fs.readFile(path);
                if (content === null) {
                    context.writer.writeError(
                        `paste: ${path}: No such file or directory`,
                    );
                    return;
                }
                let lines = content.split('\n');
                // Remove trailing empty line from trailing newline
                if (lines.length > 0 && lines[lines.length - 1] === '') {
                    lines.pop();
                }
                fileLines.push(lines);
            } catch (e: any) {
                context.writer.writeError(`paste: ${e.message}`);
                return;
            }
        }

        if (serial) {
            // Serial mode: each file's lines joined on one output line
            const output = fileLines.map((lines) =>
                lines.join(delimiter),
            );
            context.writer.writeln(output.join('\n'));
        } else {
            // Parallel mode: zip lines from all files
            const maxLines = Math.max(
                ...fileLines.map((lines) => lines.length),
            );
            const output: string[] = [];
            for (let i = 0; i < maxLines; i++) {
                const parts = fileLines.map((lines) => lines[i] || '');
                output.push(parts.join(delimiter));
            }
            context.writer.writeln(output.join('\n'));
        }
    }

    private parsePaths(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return raw.split(/\s+/).filter(Boolean);
    }
}

import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliWcCommandProcessor implements ICliCommandProcessor {
    command = 'wc';
    description = 'Print line, word, and character counts';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '#️⃣', module: 'file management' };

    parameters = [
        {
            name: 'lines',
            aliases: ['l'],
            description: 'Print only the line count',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'words',
            aliases: ['w'],
            description: 'Print only the word count',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'chars',
            aliases: ['c'],
            description: 'Print only the character count',
            required: false,
            type: 'boolean' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const showLines =
            command.args['lines'] || command.args['l'] || false;
        const showWords =
            command.args['words'] || command.args['w'] || false;
        const showChars =
            command.args['chars'] || command.args['c'] || false;
        const showAll = !showLines && !showWords && !showChars;

        const paths = this.parsePaths(command);
        if (paths.length === 0) {
            if (command.data != null) {
                const content = typeof command.data === 'string'
                    ? command.data : JSON.stringify(command.data);
                const lineCount = content === '' ? 0 : content.split('\n').length;
                const wordCount =
                    content.trim() === ''
                        ? 0
                        : content.trim().split(/\s+/).length;
                const charCount = content.length;

                const parts: string[] = [];
                if (showAll || showLines) parts.push(String(lineCount).padStart(8));
                if (showAll || showWords) parts.push(String(wordCount).padStart(8));
                if (showAll || showChars) parts.push(String(charCount).padStart(8));

                context.writer.writeln(parts.join(''));
                return;
            }
            context.writer.writeError('wc: missing file operand');
            return;
        }

        let totalLines = 0;
        let totalWords = 0;
        let totalChars = 0;

        for (const path of paths) {
            try {
                if (fs.isDirectory(path)) {
                    context.writer.writeError(`wc: ${path}: Is a directory`);
                    continue;
                }
                const content = fs.readFile(path) ?? '';
                const lineCount = content === '' ? 0 : content.split('\n').length;
                const wordCount =
                    content.trim() === ''
                        ? 0
                        : content.trim().split(/\s+/).length;
                const charCount = content.length;

                totalLines += lineCount;
                totalWords += wordCount;
                totalChars += charCount;

                const parts: string[] = [];
                if (showAll || showLines) parts.push(String(lineCount).padStart(8));
                if (showAll || showWords) parts.push(String(wordCount).padStart(8));
                if (showAll || showChars) parts.push(String(charCount).padStart(8));
                parts.push(` ${path}`);

                context.writer.writeln(parts.join(''));
            } catch (e: any) {
                context.writer.writeError(`wc: ${e.message}`);
            }
        }

        if (paths.length > 1) {
            const parts: string[] = [];
            if (showAll || showLines) parts.push(String(totalLines).padStart(8));
            if (showAll || showWords) parts.push(String(totalWords).padStart(8));
            if (showAll || showChars) parts.push(String(totalChars).padStart(8));
            parts.push(' total');
            context.writer.writeln(parts.join(''));
        }
    }

    private parsePaths(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return raw.split(/\s+/).filter(Boolean);
    }
}

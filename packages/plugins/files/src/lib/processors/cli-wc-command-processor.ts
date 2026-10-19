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
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';
import { pipedText } from '../utils/lines';

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

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'Count lines, words and characters in files or piped input. With several files, a total line is printed at the end.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['wc <file...>', 'Lines, words and characters'],
            ['wc -l <file>', 'Only the line count'],
            ['<command> | wc', 'Count piped input'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['wc notes.txt', 'All three counts'],
            ['wc -l a.txt b.txt', 'Line counts with a total'],
            [
                'cat app.log | grep error | wc -l',
                'How many lines mention error',
            ],
        ]);
    }

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
                // Piped text loses its final newline on the way: restore it
                let content = pipedText(command.data);
                if (content !== '' && !content.endsWith('\n')) content += '\n';
                const { lineCount, wordCount, charCount } = this.count(content);

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
                const { lineCount, wordCount, charCount } = this.count(content);

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

    /** Counts like Unix wc: lines are newline characters. */
    private count(content: string): {
        lineCount: number;
        wordCount: number;
        charCount: number;
    } {
        return {
            lineCount: (content.match(/\n/g) ?? []).length,
            wordCount: content.trim() === '' ? 0 : content.trim().split(/\s+/).length,
            charCount: content.length,
        };
    }

    private parsePaths(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return splitArgs(raw).filter(Boolean);
    }
}

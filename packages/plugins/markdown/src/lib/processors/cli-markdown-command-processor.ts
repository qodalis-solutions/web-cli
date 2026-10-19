import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    DefaultLibraryAuthor,
    CliIcon,
    ICliCommandChildProcessor,
    writeExamples,
    writeUsage,
    writeWrapped,
} from '@qodalis/cli-core';
import { renderMarkdown } from '../markdown-renderer';

export class CliMarkdownCommandProcessor implements ICliCommandProcessor {
    command = 'md';
    description = 'Render Markdown in the terminal';
    aliases = ['markdown'];
    author = DefaultLibraryAuthor;
    metadata = { icon: CliIcon.File };

    processors: ICliCommandChildProcessor[] = [
        {
            command: 'render',
            description: 'Render Markdown text. Pipe markdown or pass inline.',
            aliases: ['preview', 'view'],
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const input = cmd.value || (typeof cmd.data === 'string' ? cmd.data : '') || '';
                if (!input.trim()) {
                    context.writer.writeError('No markdown input. Pipe text or provide inline.');
                    return;
                }
                const lines = renderMarkdown(input);
                for (const line of lines) {
                    context.writer.writeln(line);
                }
            },
        },
    ];

    async processCommand(_: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        context.writer.writeln('Usage: echo "# Hello" | md render');
        context.writer.writeln('       md render "## Title"');
    }

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'Show Markdown formatted in the terminal: headings, bold and italic text, lists, quotes, code and links. Pass the text inline or pipe it from another command.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['md render "<markdown>"', 'Render inline text'],
            ['<command> | md render', 'Render the output of a command'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['md render "## Title"', 'A heading'],
            ['echo "# Hello" | md render', 'Piped text'],
            ['markdown view "**bold** and *italic*"', 'Same, using aliases'],
        ]);
    }
}

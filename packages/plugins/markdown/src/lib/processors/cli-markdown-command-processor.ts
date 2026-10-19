import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    DefaultLibraryAuthor,
    CliIcon,
    writeExamples,
    writeUsage,
    writeWrapped,
} from '@qodalis/cli-core';
import { renderMarkdown } from '../markdown-renderer';

/** Verbs accepted before the text: `md render "# x"` is the same as `md "# x"`. */
const RENDER_VERBS = ['render', 'preview', 'view'];

/**
 * Split raw text into shell-like words: quotes group words and are removed,
 * a backslash inside double quotes escapes the next character.
 */
export function splitWords(text: string): { word: string; quoted: boolean }[] {
    const words: { word: string; quoted: boolean }[] = [];
    let current = '';
    let inWord = false;
    let quoted = false;
    let quote: string | null = null;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
            if (ch === quote) {
                quote = null;
            } else if (ch === '\\' && quote === '"' && (text[i + 1] === '"' || text[i + 1] === '\\')) {
                current += text[++i];
            } else {
                current += ch;
            }
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            inWord = true;
            quoted = true;
            continue;
        }
        if (/\s/.test(ch)) {
            if (inWord) {
                words.push({ word: current, quoted });
                current = '';
                inWord = false;
                quoted = false;
            }
            continue;
        }
        current += ch;
        inWord = true;
    }
    if (inWord) {
        words.push({ word: current, quoted });
    }
    return words;
}

/** Interpret `\n`, `\t` and `\\` escapes typed on the command line. */
export function interpretEscapes(text: string): string {
    return text.replace(/\\([\\nt])/g, (_, ch: string) =>
        ch === 'n' ? '\n' : ch === 't' ? '\t' : '\\',
    );
}

/** Piped data as markdown text: strings as is, arrays one item per line. */
function dataToText(data: unknown): string {
    if (data === undefined || data === null) return '';
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) {
        return data.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n');
    }
    if (typeof data === 'object') {
        return '```json\n' + JSON.stringify(data, null, 2) + '\n```';
    }
    return String(data);
}

/**
 * The markdown to render: the inline value (quotes removed, escapes
 * interpreted, an optional leading `render`/`preview`/`view` dropped),
 * otherwise the piped data.
 */
export function resolveMarkdownInput(value: string | undefined, data: unknown): string {
    const words = splitWords(value ?? '');
    if (words.length && !words[0].quoted && RENDER_VERBS.includes(words[0].word.toLowerCase())) {
        words.shift();
    }
    const inline = interpretEscapes(words.map((w) => w.word).join(' '));
    if (inline.trim()) {
        return inline;
    }
    return dataToText(data);
}

export class CliMarkdownCommandProcessor implements ICliCommandProcessor {
    command = 'md';
    description = 'Render Markdown in the terminal';
    aliases = ['markdown'];
    author = DefaultLibraryAuthor;
    metadata = { icon: CliIcon.File };

    // The text after `md` is the markdown itself. There are deliberately no
    // sub-processors: with sub-processors the engine treats the first word as
    // a sub-command name, so `md "# x"` would be "command not found".
    // `render`, `preview` and `view` are accepted as optional verbs instead.
    acceptsRawInput = true;

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const input = resolveMarkdownInput(command.value, command.data);
        if (!input.trim()) {
            context.writer.writeError('No markdown input. Pipe text or provide it inline.');
            context.writer.writeln('Usage: md "# Hello"');
            context.writer.writeln('       echo "# Hello" | md');
            context.process.exit(1, { silent: true });
            return;
        }
        for (const line of renderMarkdown(input)) {
            context.writer.writeln(line);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'Show Markdown formatted in the terminal: headings, bold and italic text, lists, quotes, code and links. Pass the text inline (quoted or not, \\n starts a new line) or pipe it from another command.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['md "<markdown>"', 'Render inline text'],
            ['md render "<markdown>"', 'Same, with the optional render verb (also preview, view)'],
            ['<command> | md', 'Render the output of a command'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['md "## Title"', 'A heading'],
            ['md "# Title\\n- one\\n- two"', 'Several lines'],
            ['echo "# Hello" | md', 'Piped text'],
            ['markdown view "**bold** and *italic*"', 'Same, using aliases'],
        ]);
    }
}

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const ITALIC = '\x1b[3m';
const UNDERLINE = '\x1b[4m';

const FG_YELLOW = '\x1b[33m';
const FG_CYAN = '\x1b[36m';
const FG_GREEN = '\x1b[32m';
const FG_WHITE = '\x1b[97m';
const BG_DARK = '\x1b[48;5;236m';

function wrap(text: string, ...codes: string[]): string {
    return codes.join('') + text + RESET;
}

export function renderMarkdown(input: string): string[] {
    if (!input.trim()) return [];

    const rawLines = input.split('\n');
    const output: string[] = [];
    let inCodeBlock = false;

    for (const line of rawLines) {
        if (line.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                const lang = line.slice(3).trim();
                output.push(wrap(` ${lang || 'code'} `, DIM, BG_DARK));
            } else {
                inCodeBlock = false;
                output.push(wrap('\u2500'.repeat(40), DIM));
            }
            continue;
        }

        if (inCodeBlock) {
            output.push(wrap('  ' + line, FG_GREEN));
            continue;
        }

        if (line.startsWith('### ')) {
            output.push(wrap(line.slice(4), BOLD, FG_CYAN));
        } else if (line.startsWith('## ')) {
            const text = line.slice(3);
            output.push(wrap(text, BOLD, FG_YELLOW));
            output.push(wrap('\u2500'.repeat(text.length), FG_YELLOW));
        } else if (line.startsWith('# ')) {
            const text = line.slice(2);
            output.push(wrap(text, BOLD, UNDERLINE, FG_WHITE));
            output.push('');
        } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
            output.push(wrap('\u2500'.repeat(60), DIM));
        } else if (line.startsWith('> ')) {
            output.push(wrap('\u2502 ' + line.slice(2), DIM, ITALIC));
        } else if (/^[-*+] /.test(line)) {
            output.push('  \u2022 ' + applyInline(line.slice(2)));
        } else if (/^\d+\. /.test(line)) {
            const match = line.match(/^(\d+\.) (.*)/);
            if (match) {
                output.push(`  ${wrap(match[1], BOLD)} ${applyInline(match[2])}`);
            }
        } else if (line.trim() === '') {
            output.push('');
        } else {
            output.push(applyInline(line));
        }
    }

    return output;
}

function applyInline(text: string): string {
    // Bold **text** or __text__
    text = text.replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a, b) => wrap(a ?? b, BOLD));
    // Italic *text* or _text_
    text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)|(?<!_)_([^_]+)_(?!_)/g, (_, a, b) => wrap(a ?? b, ITALIC));
    // Inline code `text`
    text = text.replace(/`([^`]+)`/g, (_, code) => wrap(code, FG_GREEN, BG_DARK));
    // Links [text](url)
    text = text.replace(/\[(.+?)\]\((.+?)\)/g, (_, label, url) =>
        wrap(label, UNDERLINE, FG_CYAN) + wrap(` (${url})`, DIM),
    );
    return text;
}

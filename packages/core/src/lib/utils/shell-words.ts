/**
 * Split text into arguments like a POSIX shell: spaces separate words,
 * quotes are removed (`"a b"` is one word), single quotes keep everything
 * literally, and a backslash escapes the next character outside quotes
 * (`my\ file`) or `"`, `\`, `$` and `` ` `` inside double quotes. A quote
 * without a closing one is ordinary text (`it's`).
 */
export function splitShellWords(text: string): string[] {
    const words: string[] = [];
    let current = '';
    let inWord = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '\\' && i + 1 < text.length) {
            current += text[++i];
            inWord = true;
        } else if (ch === "'" && text.indexOf("'", i + 1) !== -1) {
            const end = text.indexOf("'", i + 1);
            current += text.slice(i + 1, end);
            inWord = true;
            i = end;
        } else if (ch === '"' && closingDoubleQuote(text, i) !== -1) {
            const end = closingDoubleQuote(text, i);
            current += unescapeDoubleQuoted(text.slice(i + 1, end));
            inWord = true;
            i = end;
        } else if (/\s/.test(ch)) {
            if (inWord) words.push(current);
            current = '';
            inWord = false;
        } else {
            current += ch;
            inWord = true;
        }
    }
    if (inWord) words.push(current);
    return words;
}

/**
 * The arguments as a shell's echo prints them: {@link splitShellWords}
 * joined by one space. Inside double quotes, a backslash before other
 * characters stays (`"a\nb"`) for echo's escape step.
 */
export function joinShellWords(text: string): string {
    return splitShellWords(text).join(' ');
}

/** Quote a value so {@link splitShellWords} reads it back as one word. */
export function quoteShellWord(value: string): string {
    if (value !== '' && !/[\s"'\\$`|&;<>(){}*?[\]#~]/.test(value)) return value;
    if (!value.includes("'")) return `'${value}'`;
    return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

/** Index of the `"` closing the one at `start` (skipping `\"`), or -1. */
function closingDoubleQuote(text: string, start: number): number {
    for (let i = start + 1; i < text.length; i++) {
        if (text[i] === '\\') i++;
        else if (text[i] === '"') return i;
    }
    return -1;
}

function unescapeDoubleQuoted(text: string): string {
    return text.replace(/\\(["\\$`])/g, '$1');
}

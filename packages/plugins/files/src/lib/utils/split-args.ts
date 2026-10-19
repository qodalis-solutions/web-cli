/**
 * Split command arguments on spaces, keeping quoted parts together and
 * removing the quotes: `"my file.txt" -n 'a b'` -> `my file.txt`, `-n`, `a b`.
 * Inside double quotes a backslash escapes the next character.
 */
export function splitArgs(raw: string): string[] {
    const result: string[] = [];
    let current = '';
    let inWord = false;
    let quote: '"' | "'" | null = null;

    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (quote) {
            if (ch === quote) {
                quote = null;
            } else if (ch === '\\' && quote === '"' && i + 1 < raw.length) {
                current += raw[++i];
            } else {
                current += ch;
            }
            continue;
        }
        if ((ch === '"' || ch === "'") && raw.indexOf(ch, i + 1) !== -1) {
            quote = ch;
            inWord = true;
            continue;
        }
        if (/\s/.test(ch)) {
            if (inWord) result.push(current);
            current = '';
            inWord = false;
            continue;
        }
        current += ch;
        inWord = true;
    }
    if (inWord) result.push(current);
    return result;
}

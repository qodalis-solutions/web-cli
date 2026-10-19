/**
 * The arguments as a shell's echo prints them: quotes removed, the words
 * joined by one space, spacing inside quotes kept. A quote without a closing
 * one is text (`it's`). Backslashes are left for the escape step.
 */
export function joinShellWords(text: string): string {
    const words: string[] = [];
    let current = '';
    let inWord = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if ((ch === '"' || ch === "'") && text.indexOf(ch, i + 1) !== -1) {
            const end = text.indexOf(ch, i + 1);
            current += text.slice(i + 1, end);
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
    return words.join(' ');
}

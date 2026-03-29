/**
 * Regex that matches ANSI SGR escape sequences (colors, bold, reset, etc.)
 */
const ANSI_RE = /\x1b\[[0-9;]*m/g;

/**
 * Strip all ANSI escape sequences from a string.
 * @param text The text potentially containing ANSI codes
 * @returns The text with all ANSI codes removed
 */
export function stripAnsi(text: string): string {
    return text.replace(ANSI_RE, '');
}

/**
 * Return the visible (display) width of a string in terminal columns,
 * ignoring ANSI escape codes and accounting for wide characters (emoji,
 * East Asian fullwidth, etc.) that occupy two columns.
 * @param text The text potentially containing ANSI codes
 * @returns The number of terminal columns the text occupies
 */
export function visibleLength(text: string): number {
    const stripped = stripAnsi(text);
    let width = 0;
    for (const ch of stripped) {
        const cp = ch.codePointAt(0)!;
        // Variation selectors (U+FE00–U+FE0F) are zero-width
        if (cp >= 0xfe00 && cp <= 0xfe0f) continue;
        // Zero-width joiners (U+200D) are zero-width
        if (cp === 0x200d) continue;
        // Combining marks (U+0300–U+036F) are zero-width
        if (cp >= 0x0300 && cp <= 0x036f) continue;
        width += isWideCharacter(cp) ? 2 : 1;
    }
    return width;
}

/**
 * Check if a Unicode code point occupies two terminal columns.
 */
function isWideCharacter(cp: number): boolean {
    // Surrogate-based emoji (most emoji above U+FFFF)
    if (cp >= 0x1f000) return true;
    // Miscellaneous Symbols and Pictographs, Emoticons, etc.
    if (cp >= 0x2600 && cp <= 0x27bf) return true;
    // Dingbats
    if (cp >= 0x2700 && cp <= 0x27bf) return true;
    // CJK Unified Ideographs
    if (cp >= 0x4e00 && cp <= 0x9fff) return true;
    // CJK Compatibility Ideographs
    if (cp >= 0xf900 && cp <= 0xfaff) return true;
    // Fullwidth Forms
    if (cp >= 0xff01 && cp <= 0xff60) return true;
    // Halfwidth/Fullwidth Forms (fullwidth part)
    if (cp >= 0xffe0 && cp <= 0xffe6) return true;
    // CJK Radicals Supplement, Kangxi Radicals
    if (cp >= 0x2e80 && cp <= 0x2fdf) return true;
    // CJK Symbols and Punctuation, Hiragana, Katakana
    if (cp >= 0x3000 && cp <= 0x30ff) return true;
    // Enclosed CJK Letters
    if (cp >= 0x3200 && cp <= 0x32ff) return true;
    // CJK Compatibility
    if (cp >= 0x3300 && cp <= 0x33ff) return true;
    // Enclosed Alphanumeric Supplement (circled numbers etc.)
    if (cp >= 0x1f100 && cp <= 0x1f1ff) return true;
    // Misc Symbols (some are wide in terminals)
    if (cp >= 0x2300 && cp <= 0x23ff) return true;
    return false;
}

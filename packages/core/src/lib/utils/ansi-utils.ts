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
 * Return the visible length of a string, ignoring ANSI escape codes.
 * Useful for padding/alignment calculations in terminal output.
 * @param text The text potentially containing ANSI codes
 * @returns The number of visible characters
 */
export function visibleLength(text: string): number {
    return stripAnsi(text).length;
}

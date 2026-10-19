/**
 * The lines of a text, without the empty item that a final newline leaves:
 * `a\nb\n` -> `a`, `b`. An empty text has no lines.
 */
export function splitLines(content: string): string[] {
    if (content === '') return [];
    const lines = content.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
}

/** Piped command data as text. */
export function pipedText(data: unknown): string {
    return typeof data === 'string' ? data : JSON.stringify(data);
}

/**
 * Opaque state value carried between lines during syntax highlighting.
 * Encodes context such as "inside a multi-line string" or "inside a block comment"
 * so the highlighter can resume correctly on the next line.
 * `0` typically represents the default/root state.
 */
export type LineState = number;

export interface ISyntaxHighlightRule {
    pattern: RegExp;
    tokenType: string;
    captureGroup?: number;
}

export interface ISyntaxHighlighter {
    id: string;
    /** Human-readable language name (e.g. 'TypeScript'). Falls back to `id` when absent. */
    name?: string;
    extensions: string[];
    initialState: LineState;
    getRules(state: LineState): ISyntaxHighlightRule[];
    getNextLineState(line: string, currentState: LineState): LineState;
}

export interface ISyntaxTheme {
    name: string;
    colors: Record<string, string>;
}

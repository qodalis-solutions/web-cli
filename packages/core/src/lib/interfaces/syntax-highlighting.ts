export type LineState = number;

export interface ISyntaxHighlightRule {
    pattern: RegExp;
    tokenType: string;
    captureGroup?: number;
}

export interface ISyntaxHighlighter {
    id: string;
    extensions: string[];
    initialState: LineState;
    getRules(state: LineState): ISyntaxHighlightRule[];
    getNextLineState(line: string, currentState: LineState): LineState;
}

export interface ISyntaxTheme {
    name: string;
    colors: Record<string, string>;
}

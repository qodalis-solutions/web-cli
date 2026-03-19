export interface ICliWasmAccelerator {
    /** Search for needle starting from (startRow, startCol). Returns [row, col] or [-1, -1]. */
    textSearch(
        text: string,
        needle: string,
        startRow: number,
        startCol: number,
        caseSensitive: boolean,
        wrap: boolean,
    ): [number, number];

    /** Replace all occurrences. Returns { count, text }. */
    textReplaceAll(
        text: string,
        needle: string,
        replacement: string,
        caseSensitive: boolean,
    ): { count: number; text: string };

    /** Filter candidates by prefix (case-insensitive), return sorted matches. */
    prefixMatch(candidates: string[], prefix: string): string[];

    /** Longest common prefix of the given strings. */
    commonPrefix(strings: string[]): string;

    /** Register a named rule set for syntax highlighting tokenization. */
    registerRuleSet(ruleSetId: string, rules: string): void;

    /** Tokenize a line using a previously registered rule set. Returns newline-separated "start,end,tokenType" entries. */
    tokenizeLine(line: string, ruleSetId: string): string;
}

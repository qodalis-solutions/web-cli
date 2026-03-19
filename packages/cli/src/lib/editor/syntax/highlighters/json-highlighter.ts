import { ISyntaxHighlighter, ISyntaxHighlightRule, LineState } from '@qodalis/cli-core';

export class JsonHighlighter implements ISyntaxHighlighter {
    id = 'json';
    extensions = ['.json', '.jsonc'];
    initialState: LineState = 0;

    getRules(state: LineState): ISyntaxHighlightRule[] {
        if (state === 1) {
            return [
                { pattern: /.*?\*\//, tokenType: 'comment' },
                { pattern: /.*/, tokenType: 'comment' },
            ];
        }
        return [
            { pattern: /\/\/.*$/, tokenType: 'comment' },
            { pattern: /\/\*.*?\*\//, tokenType: 'comment' },
            { pattern: /\/\*.*$/, tokenType: 'comment' },
            { pattern: /"(?:[^"\\]|\\.)*"/, tokenType: 'string' },
            { pattern: /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, tokenType: 'number' },
            { pattern: /\b(?:true|false|null)\b/, tokenType: 'keyword' },
            { pattern: /[{}\[\]:,]/, tokenType: 'punctuation' },
        ];
    }

    getNextLineState(line: string, currentState: LineState): LineState {
        if (currentState === 1) {
            return line.includes('*/') ? 0 : 1;
        }
        const stripped = line.replace(/"(?:[^"\\]|\\.)*"/g, '').replace(/\/\/.*$/, '');
        const openIdx = stripped.lastIndexOf('/*');
        if (openIdx === -1) return 0;
        const closeIdx = stripped.indexOf('*/', openIdx);
        return closeIdx === -1 ? 1 : 0;
    }
}

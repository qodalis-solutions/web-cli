import { ISyntaxHighlighter, ISyntaxHighlightRule, LineState } from '@qodalis/cli-core';

export class YamlHighlighter implements ISyntaxHighlighter {
    id = 'yaml';
    extensions = ['.yaml', '.yml'];
    initialState: LineState = 0;

    getRules(): ISyntaxHighlightRule[] {
        return [
            { pattern: /#.*$/, tokenType: 'comment' },
            { pattern: /"(?:[^"\\]|\\.)*"/, tokenType: 'string' },
            { pattern: /'[^']*'/, tokenType: 'string' },
            { pattern: /\b(?:true|false|null|~)\b/, tokenType: 'keyword' },
            { pattern: /-?\d+(?:\.\d+)?/, tokenType: 'number' },
            { pattern: /([\w][\w.\-]*)(\s*:)/, tokenType: 'tag', captureGroup: 1 },
            { pattern: /[-:\[\]{}]/, tokenType: 'punctuation' },
        ];
    }

    getNextLineState(): LineState {
        return 0;
    }
}

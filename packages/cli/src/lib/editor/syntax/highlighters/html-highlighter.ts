import { ISyntaxHighlighter, ISyntaxHighlightRule, LineState } from '@qodalis/cli-core';

export class HtmlHighlighter implements ISyntaxHighlighter {
    id = 'html';
    extensions = ['.html', '.htm', '.xml', '.svg'];
    initialState: LineState = 0;

    getRules(state: LineState): ISyntaxHighlightRule[] {
        if (state === 1) {
            return [
                { pattern: /.*?-->/, tokenType: 'comment' },
                { pattern: /.*/, tokenType: 'comment' },
            ];
        }
        return [
            { pattern: /<!--.*?-->/, tokenType: 'comment' },
            { pattern: /<!--.*$/, tokenType: 'comment' },
            { pattern: /(<\/?)([\w-]+)/, tokenType: 'tag', captureGroup: 2 },
            { pattern: /"[^"]*"/, tokenType: 'value' },
            { pattern: /'[^']*'/, tokenType: 'value' },
            { pattern: /([\w-]+)(\s*=)/, tokenType: 'attribute', captureGroup: 1 },
            { pattern: /\/?>/, tokenType: 'punctuation' },
            { pattern: /<\/?/, tokenType: 'punctuation' },
            { pattern: /=/, tokenType: 'punctuation' },
        ];
    }

    getNextLineState(line: string, currentState: LineState): LineState {
        if (currentState === 1) {
            return line.includes('-->') ? 0 : 1;
        }
        const openIdx = line.lastIndexOf('<!--');
        if (openIdx === -1) return 0;
        const closeIdx = line.indexOf('-->', openIdx);
        return closeIdx === -1 ? 1 : 0;
    }
}

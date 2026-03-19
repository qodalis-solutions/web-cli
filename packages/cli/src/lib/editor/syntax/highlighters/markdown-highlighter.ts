import { ISyntaxHighlighter, ISyntaxHighlightRule, LineState } from '@qodalis/cli-core';

export class MarkdownHighlighter implements ISyntaxHighlighter {
    id = 'markdown';
    extensions = ['.md', '.mdx', '.markdown'];
    initialState: LineState = 0;

    getRules(state: LineState): ISyntaxHighlightRule[] {
        if (state === 1) {
            return [
                { pattern: /^```/, tokenType: 'string' },
                { pattern: /.*/, tokenType: 'code' },
            ];
        }
        return [
            { pattern: /^#{1,6}\s+.*$/, tokenType: 'heading' },
            { pattern: /^```/, tokenType: 'string' },
            { pattern: /`[^`]+`/, tokenType: 'code' },
            { pattern: /\[[^\]]+\]\([^)]+\)/, tokenType: 'link' },
            { pattern: /\*\*[^*]+\*\*/, tokenType: 'bold' },
            { pattern: /__[^_]+__/, tokenType: 'bold' },
            { pattern: /\*[^*]+\*/, tokenType: 'italic' },
            { pattern: /_[^_]+_/, tokenType: 'italic' },
            { pattern: /^[-*>]\s/, tokenType: 'punctuation' },
        ];
    }

    getNextLineState(line: string, currentState: LineState): LineState {
        const trimmed = line.trimStart();
        if (trimmed.startsWith('```')) {
            return currentState === 0 ? 1 : 0;
        }
        return currentState;
    }
}

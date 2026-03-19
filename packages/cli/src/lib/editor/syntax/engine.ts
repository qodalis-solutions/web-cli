import { ISyntaxHighlighter, ISyntaxTheme, LineState } from '@qodalis/cli-core';
import { ICliWasmAccelerator } from '../../wasm/types';
import { parseTokens, truncateAnsi } from './utils';

interface CachedLine {
    lineContent: string;
    entryState: LineState;
    exitState: LineState;
    rendered: string;
}

export class SyntaxHighlightEngine {
    private cache = new Map<number, CachedLine>();
    private registeredRuleSets = new Set<string>();

    constructor(
        private readonly highlighter: ISyntaxHighlighter,
        private readonly theme: ISyntaxTheme,
        private readonly accelerator: ICliWasmAccelerator,
    ) {}

    invalidate(fromLine: number): void {
        for (const key of this.cache.keys()) {
            if (key >= fromLine) {
                this.cache.delete(key);
            }
        }
    }

    renderLine(lineIdx: number, line: string, cols: number): string {
        const entryState = lineIdx === 0
            ? this.highlighter.initialState
            : (this.cache.get(lineIdx - 1)?.exitState ?? this.highlighter.initialState);

        const cached = this.cache.get(lineIdx);
        if (cached && cached.lineContent === line && cached.entryState === entryState) {
            return truncateAnsi(cached.rendered, cols);
        }

        try {
            const ruleSetId = `${this.highlighter.id}:${entryState}`;
            if (!this.registeredRuleSets.has(ruleSetId)) {
                const rules = this.highlighter.getRules(entryState);
                const serialized = rules.map(r =>
                    `${r.pattern.source}\t${r.tokenType}\t${r.captureGroup ?? 0}`
                ).join('\n');
                this.accelerator.registerRuleSet(ruleSetId, serialized);
                this.registeredRuleSets.add(ruleSetId);
            }

            const raw = this.accelerator.tokenizeLine(line, ruleSetId);
            const tokens = parseTokens(raw);
            const exitState = this.highlighter.getNextLineState(line, entryState);
            const rendered = this.applyTheme(line, tokens);

            this.cache.set(lineIdx, { lineContent: line, entryState, exitState, rendered });

            return truncateAnsi(rendered, cols);
        } catch {
            return line.length > cols ? line.slice(0, cols) : line;
        }
    }

    private applyTheme(
        line: string,
        tokens: Array<{ start: number; end: number; tokenType: string }>,
    ): string {
        if (tokens.length === 0) return line;

        let result = '';
        let pos = 0;

        for (const token of tokens) {
            if (token.start > pos) {
                result += line.slice(pos, token.start);
            }
            const color = this.theme.colors[token.tokenType];
            const text = line.slice(token.start, token.end);
            if (color) {
                result += color + text + '\x1b[0m';
            } else {
                result += text;
            }
            pos = token.end;
        }

        if (pos < line.length) {
            result += line.slice(pos);
        }

        return result;
    }
}

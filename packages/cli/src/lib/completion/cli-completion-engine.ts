import {
    ICliCompletionProvider,
    ICliCompletionContext,
} from '@qodalis/cli-core';
import { getAccelerator } from '../wasm';

export interface CompletionResult {
    /** Matching candidates */
    candidates: string[];
    /** The token being completed */
    token: string;
    /** Start index of the token in the input */
    tokenStart: number;
}

/**
 * Manages tab-completion by querying registered providers in priority order.
 * Implements bash-style behavior:
 *  - First Tab: complete common prefix (or single match fully)
 *  - Second Tab: display all candidates
 */
export class CliCompletionEngine {
    private providers: ICliCompletionProvider[] = [];
    private lastCandidates: string[] = [];
    private tabCount = 0;
    private lastInput = '';

    setProviders(providers: ICliCompletionProvider[]): void {
        this.providers = [...providers].sort((a, b) => a.priority - b.priority);
    }

    addProvider(provider: ICliCompletionProvider): void {
        this.providers.push(provider);
        this.providers.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Reset tab state. Call on any non-tab keypress.
     */
    resetState(): void {
        this.tabCount = 0;
        this.lastCandidates = [];
        this.lastInput = '';
    }

    /**
     * Process a tab press. Returns the completion result.
     */
    async complete(
        input: string,
        cursor: number,
    ): Promise<{
        /** What to do */
        action: 'complete' | 'show-candidates' | 'none';
        /** Replacement text for the token (when action = 'complete') */
        replacement?: string;
        /** Where the token starts in the input */
        tokenStart?: number;
        /** The original token */
        token?: string;
        /** All candidates (when action = 'show-candidates') */
        candidates?: string[];
    }> {
        // Parse input into completion context
        const ctx = this.buildContext(input, cursor);

        // Track consecutive tabs on the same input
        if (input === this.lastInput) {
            this.tabCount++;
        } else {
            this.tabCount = 1;
            this.lastInput = input;
            this.lastCandidates = [];
        }

        // On first tab (or input changed), fetch completions
        if (this.tabCount === 1) {
            const candidates = await this.fetchCompletions(ctx);
            this.lastCandidates = candidates;

            if (candidates.length === 0) {
                return { action: 'none' };
            }

            if (candidates.length === 1) {
                // Single match — complete fully with trailing space
                this.lastInput = ''; // Reset so next tab re-evaluates
                this.tabCount = 0;
                return {
                    action: 'complete',
                    replacement: candidates[0],
                    tokenStart: ctx.tokenStart,
                    token: ctx.token,
                };
            }

            // Multiple matches — complete common prefix
            const common = this.commonPrefix(candidates);
            if (common.length > ctx.token.length) {
                // We can extend the current token
                this.lastInput =
                    input.slice(0, ctx.tokenStart) +
                    common +
                    input.slice(ctx.tokenStart + ctx.token.length);
                return {
                    action: 'complete',
                    replacement: common,
                    tokenStart: ctx.tokenStart,
                    token: ctx.token,
                };
            }

            // Common prefix = current token, nothing more to complete on first tab
            return { action: 'none' };
        }

        // Second tab — show all candidates
        if (this.tabCount >= 2 && this.lastCandidates.length > 1) {
            return {
                action: 'show-candidates',
                candidates: this.lastCandidates,
            };
        }

        return { action: 'none' };
    }

    private buildContext(input: string, cursor: number): ICliCompletionContext {
        // Tokenize input up to cursor
        const beforeCursor = input.slice(0, cursor);
        const tokens = this.tokenize(beforeCursor);
        const allTokens = this.tokenize(input);

        // Find which token the cursor is in
        let tokenStart = 0;
        let token = '';
        let tokenIndex = 0;

        if (tokens.length === 0 || beforeCursor.endsWith(' ')) {
            // Cursor is at a new token position (after a space or empty input)
            token = '';
            tokenStart = cursor;
            tokenIndex = tokens.length;
        } else {
            // Cursor is within the last token
            token = tokens[tokens.length - 1];
            tokenStart = beforeCursor.lastIndexOf(token);
            tokenIndex = tokens.length - 1;
        }

        return {
            input,
            cursor,
            token,
            tokenStart,
            tokenIndex,
            tokens: allTokens,
        };
    }

    private tokenize(input: string): string[] {
        return input.split(/\s+/).filter(Boolean);
    }

    private async fetchCompletions(
        ctx: ICliCompletionContext,
    ): Promise<string[]> {
        for (const provider of this.providers) {
            const result = await provider.getCompletions(ctx);
            if (result.length > 0) {
                return result;
            }
        }
        return [];
    }

    /**
     * Return the single best completion string for ghost-text display.
     * Returns null if there is no clear best match or multiple candidates.
     */
    async completeSingle(input: string, cursor: number): Promise<string | null> {
        if (!input) return null;
        const ctx = this.buildContext(input, cursor);
        const candidates = await this.fetchCompletions(ctx);
        if (candidates.length !== 1) return null;
        const match = candidates[0];
        if (!match.startsWith(ctx.token)) return null;
        return input.slice(0, ctx.tokenStart) + match;
    }

    private commonPrefix(strings: string[]): string {
        return getAccelerator().commonPrefix(strings);
    }
}

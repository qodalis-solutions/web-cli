/**
 * Token for registering completion providers via module services (multi: true).
 */
export const ICliCompletionProvider_TOKEN = 'cli-completion-provider';

/**
 * Context passed to completion providers describing the current input state.
 */
export interface ICliCompletionContext {
    /** Full current line text */
    input: string;

    /** Cursor position in the line */
    cursor: number;

    /** The token (word) being completed at the cursor position */
    token: string;

    /** Start index of the token in the input string */
    tokenStart: number;

    /** Index of the token among all tokens (0 = command, 1+ = arguments) */
    tokenIndex: number;

    /** All tokens parsed from the input */
    tokens: string[];
}

/**
 * Provides tab-completion candidates for CLI input.
 * Plugins can register providers to extend completion (e.g. file paths, custom values).
 */
export interface ICliCompletionProvider {
    /**
     * Priority order. Lower values are checked first.
     * Built-in defaults: 100 (commands), 200 (parameters).
     * Plugins should use lower values (e.g. 50) to take precedence for specific commands.
     */
    priority: number;

    /**
     * Return completion candidates for the current input context.
     * Return an empty array if this provider does not apply.
     */
    getCompletions(
        context: ICliCompletionContext,
    ): string[] | Promise<string[]>;
}

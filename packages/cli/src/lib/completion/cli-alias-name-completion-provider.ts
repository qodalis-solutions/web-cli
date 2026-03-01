import {
    ICliCompletionProvider,
    ICliCompletionContext,
} from '@qodalis/cli-core';
import { ICliStateStoreManager } from '../state/cli-state-store-manager';

/**
 * Provides tab-completion for alias names when typing `unalias <name>`.
 *
 * Priority 50 — checked before command and parameter completion.
 */
export class CliAliasNameCompletionProvider
    implements ICliCompletionProvider
{
    priority = 50;

    constructor(
        private readonly stateStoreManager: ICliStateStoreManager,
    ) {}

    getCompletions(context: ICliCompletionContext): string[] {
        const { tokens, tokenIndex, token } = context;

        if (tokenIndex !== 1 || tokens.length < 1) {
            return [];
        }

        const rootCommand = tokens[0].toLowerCase();
        if (rootCommand !== 'unalias') {
            return [];
        }

        const store = this.stateStoreManager.getStateStore('aliases');
        const state = store.getState<Record<string, any>>();
        const aliases = state?.aliases;

        if (!aliases || typeof aliases !== 'object') {
            return [];
        }

        const lowerPrefix = token.toLowerCase();

        return Object.keys(aliases)
            .filter((name) => name.toLowerCase().startsWith(lowerPrefix))
            .sort();
    }
}

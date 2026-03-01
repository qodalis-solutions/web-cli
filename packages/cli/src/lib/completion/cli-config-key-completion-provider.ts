import {
    ICliCompletionProvider,
    ICliCompletionContext,
    ICliCommandProcessorRegistry,
    resolveConfigurationCategories,
} from '@qodalis/cli-core';

/**
 * Sub-commands of `configure` that accept a config key value.
 */
const CONFIG_KEY_SUBCOMMANDS = new Set(['get', 'set']);

/**
 * Built-in system configuration keys (must stay in sync with
 * CliConfigureCommandProcessor's SYSTEM_OPTIONS).
 */
const SYSTEM_KEYS = ['logLevel', 'welcomeMessage'];

/**
 * Provides tab-completion for configuration keys when typing
 * `configure get <category.key>` or `configure set <category.key>`.
 *
 * Priority 50 — checked before command and parameter completion.
 */
export class CliConfigKeyCompletionProvider
    implements ICliCompletionProvider
{
    priority = 50;

    constructor(
        private readonly registry: ICliCommandProcessorRegistry,
    ) {}

    getCompletions(context: ICliCompletionContext): string[] {
        const { tokens, tokenIndex, token } = context;

        if (tokenIndex !== 2 || tokens.length < 2) {
            return [];
        }

        const rootCommand = tokens[0].toLowerCase();
        if (rootCommand !== 'configure') {
            return [];
        }

        const subCommand = tokens[1].toLowerCase();
        if (!CONFIG_KEY_SUBCOMMANDS.has(subCommand)) {
            return [];
        }

        const keys = this.getAllConfigKeys();
        const lowerPrefix = token.toLowerCase();

        return keys
            .filter((key) => key.toLowerCase().startsWith(lowerPrefix))
            .sort();
    }

    private getAllConfigKeys(): string[] {
        const keys: string[] = [];

        // System keys
        for (const key of SYSTEM_KEYS) {
            keys.push(`system.${key}`);
        }

        // Plugin keys
        const categories = resolveConfigurationCategories(this.registry);
        for (const [category, { options }] of categories) {
            for (const option of options) {
                keys.push(`${category}.${option.key}`);
            }
        }

        return keys;
    }
}

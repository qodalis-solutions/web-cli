import {
    ICliCompletionProvider,
    ICliCompletionContext,
    DefaultThemes,
} from '@qodalis/cli-core';

/**
 * Sub-commands of `theme` (and alias `themes`) that accept a theme name value.
 */
const THEME_NAME_SUBCOMMANDS = new Set(['preview', 'apply']);

/**
 * Provides tab-completion for theme names when typing
 * `theme preview <name>` or `theme apply <name>`.
 *
 * Priority 50 — checked before command and parameter completion.
 */
export class CliThemeNameCompletionProvider
    implements ICliCompletionProvider
{
    priority = 50;

    private readonly themeNames = Object.keys(DefaultThemes);

    getCompletions(context: ICliCompletionContext): string[] {
        const { tokens, tokenIndex, token } = context;

        if (tokenIndex !== 2 || tokens.length < 2) {
            return [];
        }

        const rootCommand = tokens[0].toLowerCase();
        if (rootCommand !== 'theme' && rootCommand !== 'themes') {
            return [];
        }

        const subCommand = tokens[1].toLowerCase();
        if (!THEME_NAME_SUBCOMMANDS.has(subCommand)) {
            return [];
        }

        const lowerPrefix = token.toLowerCase();

        return this.themeNames
            .filter((name) => name.toLowerCase().startsWith(lowerPrefix))
            .sort();
    }
}

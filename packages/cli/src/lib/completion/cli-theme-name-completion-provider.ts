import {
    ICliCompletionProvider,
    ICliCompletionContext,
    DefaultThemes,
} from '@qodalis/cli-core';

const THEME_NAME_SUBCOMMANDS = new Set(['preview', 'apply']);
const RANDOM_FILTER_VALUES = ['dark', 'light'];
const SEARCH_TAGS = [
    'popular',
    'retro',
    'fun',
    'pastel',
    'accessibility',
    'built-in',
    'dark',
    'light',
];

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
        const lowerPrefix = token.toLowerCase();

        if (THEME_NAME_SUBCOMMANDS.has(subCommand)) {
            return this.themeNames
                .filter((name) =>
                    name.toLowerCase().startsWith(lowerPrefix),
                )
                .sort();
        }

        if (subCommand === 'random') {
            return RANDOM_FILTER_VALUES.filter((v) =>
                v.startsWith(lowerPrefix),
            );
        }

        if (subCommand === 'search') {
            return SEARCH_TAGS.filter((t) =>
                t.startsWith(lowerPrefix),
            );
        }

        return [];
    }
}

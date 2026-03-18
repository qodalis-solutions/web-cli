import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    CliStateConfiguration,
    ICliCommandAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    CliThemeInfo,
} from '@qodalis/cli-core';

import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { ITheme } from '@xterm/xterm';
import { themes, ThemeState, themeInfos } from './types';

/** Convert a hex color string (#RRGGBB) to {r, g, b}. Returns null on invalid input. */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const m = /^#?([0-9A-Fa-f]{6})$/.exec(hex);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** Render a colored block (██) using 24-bit ANSI true color for the given hex value. */
function colorSwatch(hex: string | undefined): string {
    if (!hex) return '  ';
    const rgb = hexToRgb(hex);
    if (!rgb) return '  ';
    return `\x1b[48;2;${rgb.r};${rgb.g};${rgb.b}m  \x1b[0m`;
}

/** Render text with a 24-bit ANSI foreground color. */
function colorText(text: string, hex: string | undefined): string {
    if (!hex) return text;
    const rgb = hexToRgb(hex);
    if (!rgb) return text;
    return `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m${text}\x1b[0m`;
}

/** The subset of ITheme color keys displayed as palette swatches. */
const PALETTE_KEYS: (keyof ITheme)[] = [
    'black',
    'red',
    'green',
    'yellow',
    'blue',
    'magenta',
    'cyan',
    'white',
    'brightBlack',
    'brightRed',
    'brightGreen',
    'brightYellow',
    'brightBlue',
    'brightMagenta',
    'brightCyan',
    'brightWhite',
];

export class CliThemeCommandProcessor implements ICliCommandProcessor {
    command = 'theme';

    aliases = ['themes'];

    description = 'Interact with the theme';

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    version?: string | undefined = '2.0.0';

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        icon: '🎨',
        module: 'system',
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {
            selectedTheme: 'default',
            customOptions: null,
        },
    };

    private themeOptions: string[] = Object.keys(themeOptions);

    private defaultTheme!: ITheme;

    constructor() {
        this.processors = [
            {
                command: 'list',
                description: 'List available themes with color previews',
                processCommand: async (
                    _: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const state = context.state.getState<ThemeState>();
                    const currentName = state.selectedTheme || '';

                    const darkThemes = Object.entries(themeInfos).filter(
                        ([, info]) => info.category === 'dark',
                    );
                    const lightThemes = Object.entries(themeInfos).filter(
                        ([, info]) => info.category === 'light',
                    );

                    const renderGroup = (
                        groupLabel: string,
                        entries: [string, CliThemeInfo][],
                    ) => {
                        context.writer.writeln(
                            context.writer.wrapInColor(
                                `  ${groupLabel}`,
                                CliForegroundColor.Yellow,
                            ),
                        );
                        context.writer.writeln();
                        for (const [name, info] of entries) {
                            const active =
                                name === currentName ? ' (active)' : '';
                            const swatches = PALETTE_KEYS.map((k) =>
                                colorSwatch(info.theme[k] as string),
                            ).join('');
                            const nameLabel = context.writer.wrapInColor(
                                name.padEnd(22),
                                CliForegroundColor.Cyan,
                            );
                            context.writer.writeln(
                                `    ${swatches} ${nameLabel} ${info.description}${active}`,
                            );
                        }
                        context.writer.writeln();
                    };

                    context.writer.writeln('Available themes:');
                    context.writer.writeln();
                    renderGroup('Dark', darkThemes);
                    renderGroup('Light', lightThemes);

                    context.writer.writeInfo(
                        `Use ${context.writer.wrapInColor('theme apply <name>', CliForegroundColor.Cyan)} or ${context.writer.wrapInColor('theme apply', CliForegroundColor.Cyan)} to select interactively`,
                    );
                },
            },
            {
                command: 'current',
                description: 'Show the current theme with color swatches',
                processCommand: async (
                    _: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const state = context.state.getState<ThemeState>();
                    const themeName = state.selectedTheme || 'custom';
                    const currentTheme = context.terminal.options.theme!;

                    context.writer.writeln(
                        `Current theme: ${context.writer.wrapInColor(themeName, CliForegroundColor.Cyan)}`,
                    );
                    context.writer.writeln();

                    // Background and foreground
                    const bg = currentTheme.background as string | undefined;
                    const fg = currentTheme.foreground as string | undefined;
                    context.writer.writeln(
                        `  ${colorSwatch(bg)} background  ${bg || 'default'}`,
                    );
                    context.writer.writeln(
                        `  ${colorSwatch(fg)} foreground  ${fg || 'default'}`,
                    );
                    if (currentTheme.cursor) {
                        context.writer.writeln(
                            `  ${colorSwatch(currentTheme.cursor as string)} cursor      ${currentTheme.cursor}`,
                        );
                    }
                    context.writer.writeln();

                    // Color palette
                    context.writer.writeln('  Normal colors:');
                    const normal = PALETTE_KEYS.slice(0, 8);
                    for (const key of normal) {
                        const val = currentTheme[key] as string | undefined;
                        if (val) {
                            context.writer.writeln(
                                `    ${colorSwatch(val)} ${String(key).padEnd(10)} ${val}`,
                            );
                        }
                    }

                    context.writer.writeln();
                    context.writer.writeln('  Bright colors:');
                    const bright = PALETTE_KEYS.slice(8);
                    for (const key of bright) {
                        const val = currentTheme[key] as string | undefined;
                        if (val) {
                            context.writer.writeln(
                                `    ${colorSwatch(val)} ${String(key).padEnd(16)} ${val}`,
                            );
                        }
                    }

                    context.process.output({
                        theme: themeName,
                        colors: currentTheme,
                    });
                },
            },
            {
                command: 'preview',
                description: 'Preview a theme without applying it',
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const name = command.value!;
                    const t = themes[name];
                    if (!t) {
                        context.writer.writeError(
                            `Theme not found: ${name}. Use ${context.writer.wrapInColor('theme list', CliForegroundColor.Cyan)} to see available themes.`,
                        );
                        return;
                    }

                    this.renderThemePreview(name, t, context);
                },
            },
            {
                command: 'apply',
                description:
                    'Apply a theme (interactive with live preview if no name given)',
                acceptsRawInput: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    let themeName = command.value?.trim();

                    if (!themeName) {
                        // Interactive selection with live preview
                        const originalTheme = {
                            ...context.terminal.options.theme,
                        };
                        const options = Object.keys(themes).map((name) => ({
                            label: name,
                            value: name,
                        }));

                        const selected = await context.reader.readSelect(
                            'Select a theme (live preview):',
                            options,
                            {
                                onChange: (value) => {
                                    // Live preview: apply theme as user navigates
                                    if (themes[value]) {
                                        context.terminal.options.theme =
                                            themes[value];
                                        this.applyStyles(context);
                                    }
                                },
                            },
                        );

                        if (!selected) {
                            // Cancelled — restore original theme
                            context.terminal.options.theme = originalTheme;
                            this.applyStyles(context);
                            context.writer.writeInfo(
                                'Theme selection cancelled',
                            );
                            return;
                        }
                        themeName = selected;
                    }

                    if (!themes[themeName]) {
                        context.writer.writeError(
                            `Theme not found: ${themeName}. Use ${context.writer.wrapInColor('theme list', CliForegroundColor.Cyan)} to see available themes.`,
                        );
                        return;
                    }

                    context.terminal.options.theme = themes[themeName];

                    context.state.updateState({
                        selectedTheme: themeName,
                        customOptions: null,
                    });

                    await context.state.persist();

                    this.applyStyles(context);

                    context.writer.writeSuccess(`Theme "${themeName}" applied`);
                },
            },
            {
                command: 'set',
                acceptsRawInput: true,
                description: 'Set a theme variable',
                parameters: [
                    {
                        name: 'save',
                        description: 'Save the theme settings',
                        type: 'boolean',
                        required: false,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const [key, value] = command.command.split(' ').slice(2);

                    if (!key || !value) {
                        context.writer.writeError(
                            `Usage: theme set <key> <value>`,
                        );
                        context.writer.writeln();
                        context.writer.writeInfo(
                            `Available keys: ${this.themeOptions.join(', ')}`,
                        );
                        return;
                    }

                    if (!this.themeOptions.includes(key)) {
                        context.writer.writeError(`Unsupported key: ${key}`);
                        context.writer.writeln();
                        context.writer.writeInfo(
                            `Supported keys: ${this.themeOptions.join(', ')}`,
                        );
                        return;
                    }

                    context.terminal.options.theme = {
                        ...context.terminal.options.theme,
                        [key]: value,
                    };

                    context.state.updateState({
                        selectedTheme: null,
                        customOptions: context.terminal.options.theme,
                    });

                    const swatch = colorSwatch(value);
                    context.writer.writeSuccess(
                        `Set ${key} to ${swatch} ${value}`,
                    );

                    this.applyStyles(context);

                    if (command.args['save']) {
                        await this.saveTheme(context);
                    }
                },
            },
            {
                command: 'save',
                description: 'Save the current theme settings',
                processCommand: async (
                    _: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const state = context.state.getState<ThemeState>();

                    // If we have a named theme, persist that reference;
                    // otherwise persist the current terminal theme as custom options.
                    if (!state.selectedTheme) {
                        context.state.updateState({
                            selectedTheme: null,
                            customOptions: {
                                ...context.terminal.options.theme,
                            },
                        });
                    }

                    await this.saveTheme(context);
                },
            },
            {
                command: 'reset',
                description: 'Reset the theme to the default',
                processCommand: async (
                    _: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    context.terminal.options.theme = { ...this.defaultTheme };
                    context.state.reset();
                    await context.state.persist();
                    this.applyStyles(context);
                    context.writer.writeSuccess('Theme reset to default');
                },
            },
            {
                command: 'search',
                description: 'Search themes by name, tag, or description',
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const query = command.value!.toLowerCase();
                    const matches = Object.entries(themeInfos).filter(
                        ([name, info]) =>
                            name.toLowerCase().includes(query) ||
                            info.description.toLowerCase().includes(query) ||
                            info.tags.some((t) =>
                                t.toLowerCase().includes(query),
                            ),
                    );

                    if (matches.length === 0) {
                        context.writer.writeWarning(
                            `No themes matching "${command.value}"`,
                        );
                        return;
                    }

                    context.writer.writeln(
                        `Found ${matches.length} theme${matches.length > 1 ? 's' : ''} matching "${command.value}":`,
                    );
                    context.writer.writeln();

                    for (const [name, info] of matches) {
                        const swatches = PALETTE_KEYS.map((k) =>
                            colorSwatch(info.theme[k] as string),
                        ).join('');
                        const nameLabel = context.writer.wrapInColor(
                            name.padEnd(22),
                            CliForegroundColor.Cyan,
                        );
                        const tags = info.tags
                            .map((t) =>
                                context.writer.wrapInColor(
                                    `#${t}`,
                                    CliForegroundColor.Magenta,
                                ),
                            )
                            .join(' ');
                        context.writer.writeln(
                            `  ${swatches} ${nameLabel} ${info.description}  ${tags}`,
                        );
                    }
                },
            },
            {
                command: 'random',
                description:
                    'Apply a random theme (optionally filter by "dark" or "light")',
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const filter = command.value?.toLowerCase() as
                        | 'dark'
                        | 'light'
                        | undefined;
                    let candidates = Object.entries(themeInfos);

                    if (filter === 'dark' || filter === 'light') {
                        candidates = candidates.filter(
                            ([, info]) => info.category === filter,
                        );
                    }

                    const [name, info] =
                        candidates[
                            Math.floor(Math.random() * candidates.length)
                        ];

                    context.terminal.options.theme = info.theme;

                    context.state.updateState({
                        selectedTheme: name,
                        customOptions: null,
                    });

                    await context.state.persist();
                    this.applyStyles(context);

                    context.writer.writeSuccess(
                        `Random theme "${name}" applied`,
                    );
                },
            },
            {
                command: 'export',
                description: 'Export the current theme as JSON',
                processCommand: async (
                    _: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const currentTheme = context.terminal.options.theme;
                    const json = JSON.stringify(currentTheme, null, 2);

                    context.writer.writeln(json);

                    context.process.output({ json });
                },
            },
            {
                command: 'import',
                description: 'Import a theme from JSON',
                processCommand: async (
                    _: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    context.writer.writeln(
                        'Paste your theme JSON (single line or multi-line, then press Enter on an empty line):',
                    );

                    let jsonStr = '';
                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        const line =
                            await context.reader.readLine('');
                        if (line === null || line.trim() === '')
                            break;
                        jsonStr += line;
                    }

                    if (!jsonStr.trim()) {
                        context.writer.writeWarning(
                            'Import cancelled - no input',
                        );
                        return;
                    }

                    let imported: ITheme;
                    try {
                        imported = JSON.parse(jsonStr);
                    } catch {
                        context.writer.writeError(
                            'Invalid JSON. Please provide a valid theme object.',
                        );
                        return;
                    }

                    if (
                        typeof imported !== 'object' ||
                        imported === null ||
                        !imported.background ||
                        !imported.foreground
                    ) {
                        context.writer.writeError(
                            'Theme must be an object with at least "background" and "foreground" properties.',
                        );
                        return;
                    }

                    context.terminal.options.theme = imported;

                    context.state.updateState({
                        selectedTheme: null,
                        customOptions: imported,
                    });

                    await context.state.persist();
                    this.applyStyles(context);

                    context.writer.writeSuccess(
                        'Custom theme imported and applied',
                    );
                },
            },
        ];
    }

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.defaultTheme = context.terminal.options.theme!;
        const state = context.state.getState<ThemeState>();

        if (state.selectedTheme && state.selectedTheme !== 'default') {
            const theme = themes[state.selectedTheme];
            if (theme) {
                context.terminal.options.theme = theme;
            }
        } else if (state.customOptions) {
            context.terminal.options.theme = state.customOptions;
        }

        this.applyStyles(context);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.executor.showHelp(command, context);
    }

    private renderThemePreview(
        name: string,
        theme: ITheme,
        context: ICliExecutionContext,
    ): void {
        const { writer } = context;
        const bg = theme.background as string | undefined;
        const fg = theme.foreground as string | undefined;

        writer.writeln(
            `Theme: ${writer.wrapInColor(name, CliForegroundColor.Cyan)}`,
        );
        writer.writeln();

        // Background/foreground preview
        if (bg && fg) {
            const rgb = hexToRgb(bg);
            const frgb = hexToRgb(fg);
            if (rgb && frgb) {
                const sample = `\x1b[48;2;${rgb.r};${rgb.g};${rgb.b}m\x1b[38;2;${frgb.r};${frgb.g};${frgb.b}m  ${name.padEnd(20)} Sample text  \x1b[0m`;
                writer.writeln(`  ${sample}`);
                writer.writeln();
            }
        }

        // Color palette
        writer.writeln('  Normal:');
        const normal: (keyof ITheme)[] = [
            'black',
            'red',
            'green',
            'yellow',
            'blue',
            'magenta',
            'cyan',
            'white',
        ];
        let row = '    ';
        for (const key of normal) {
            const val = theme[key] as string | undefined;
            row += colorSwatch(val) + ' ';
        }
        writer.writeln(row);
        row = '    ';
        for (const key of normal) {
            const val = theme[key] as string | undefined;
            row += colorText(String(key).slice(0, 2).padEnd(2), val) + ' ';
        }
        writer.writeln(row);

        writer.writeln();
        writer.writeln('  Bright:');
        const bright: (keyof ITheme)[] = [
            'brightBlack',
            'brightRed',
            'brightGreen',
            'brightYellow',
            'brightBlue',
            'brightMagenta',
            'brightCyan',
            'brightWhite',
        ];
        row = '    ';
        for (const key of bright) {
            const val = theme[key] as string | undefined;
            row += colorSwatch(val) + ' ';
        }
        writer.writeln(row);
        row = '    ';
        for (const key of bright) {
            const val = theme[key] as string | undefined;
            // Show abbreviated label: "bk", "rd", "gr", "yl", "bl", "mg", "cy", "wh"
            const label = String(key)
                .replace('bright', '')
                .slice(0, 2)
                .toLowerCase();
            row += colorText(label.padEnd(2), val) + ' ';
        }
        writer.writeln(row);

        writer.writeln();
        writer.writeln(`  ${colorSwatch(bg)} background  ${bg || 'default'}`);
        writer.writeln(`  ${colorSwatch(fg)} foreground  ${fg || 'default'}`);
        if (theme.cursor) {
            writer.writeln(
                `  ${colorSwatch(theme.cursor as string)} cursor      ${theme.cursor}`,
            );
        }
    }

    private applyStyles(context: ICliExecutionContext) {
        const parents = document.getElementsByClassName('terminal-container');

        for (const parent of Array.from(parents)) {
            (parent as HTMLElement).style.background =
                context.terminal.options.theme?.background ||
                this.defaultTheme.background!;
        }
    }

    private async saveTheme(context: ICliExecutionContext): Promise<void> {
        await context.state.persist();

        context.writer.writeSuccess('Theme saved');
    }

    writeDescription?(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(
            t.t('cli.theme.long_description', 'Customize the terminal appearance with themes and colors'),
        );
        writer.writeln();
        writer.writeln(t.t('cli.common.usage', 'Usage:'));
        writer.writeln(
            `  ${writer.wrapInColor('theme list', CliForegroundColor.Cyan)}                     List themes grouped by dark/light`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('theme apply', CliForegroundColor.Cyan)}                    Select a theme interactively`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('theme apply <name>', CliForegroundColor.Cyan)}             Apply a theme by name`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('theme preview <name>', CliForegroundColor.Cyan)}           Preview a theme without applying`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('theme search <keyword>', CliForegroundColor.Cyan)}         Search by name, tag, or description`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('theme random [dark|light]', CliForegroundColor.Cyan)}      Apply a random theme`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('theme current', CliForegroundColor.Cyan)}                  Show active theme with swatches`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('theme set <key> <value>', CliForegroundColor.Cyan)}        Set a theme variable`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('theme export', CliForegroundColor.Cyan)}                   Export current theme as JSON`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('theme import', CliForegroundColor.Cyan)}                   Import a theme from JSON`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('theme save', CliForegroundColor.Cyan)}                     Save current settings`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('theme reset', CliForegroundColor.Cyan)}                    Reset to default`,
        );
        writer.writeln();
        writer.writeln(t.t('cli.common.examples', 'Examples:'));
        writer.writeln(
            `  theme apply dracula              ${writer.wrapInColor('# Apply the Dracula theme', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  theme apply tokyoNight           ${writer.wrapInColor('# Apply Tokyo Night', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  theme preview nord               ${writer.wrapInColor('# Preview Nord palette', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  theme search retro               ${writer.wrapInColor('# Find retro-style themes', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  theme random dark                ${writer.wrapInColor('# Apply a random dark theme', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  theme set background #1a1a2e     ${writer.wrapInColor('# Change background color', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  theme export                     ${writer.wrapInColor('# Export theme as JSON', CliForegroundColor.Green)}`,
        );
        writer.writeln();
        writer.writeln(
            `Available color keys: ${writer.wrapInColor(this.themeOptions.join(', ') ?? '', CliForegroundColor.Blue)}`,
        );
    }
}

const themeOptions: ITheme = {
    background: '',
    foreground: '',
    black: '',
    blue: '',
    brightBlack: '',
    brightBlue: '',
    brightCyan: '',
    brightGreen: '',
    brightMagenta: '',
    brightRed: '',
    brightWhite: '',
    brightYellow: '',
    cyan: '',
    green: '',
    magenta: '',
    red: '',
    white: '',
    yellow: '',
    cursor: '',
    cursorAccent: '',
    selectionBackground: '',
    selectionForeground: '',
    selectionInactiveBackground: '',
};

import type { ITheme } from '@xterm/xterm';
import type { CliPanelCustomColors, CliPanelTheme } from '../models/options';
import { DefaultThemes } from '../themes/default-themes';
import { colorSchemeOf } from './panel-theme-sync';

const STORAGE_KEY = 'cli-panel-theme';
const COLORS_STORAGE_KEY = 'cli-panel-theme-colors';

/** The theme picker's choice for the user's own colors. */
export const PANEL_CUSTOM_THEME = 'custom';

/** The choices of the panel's theme picker that are not terminal themes. */
export const PANEL_THEME_MODES: readonly string[] = ['auto', 'light', 'dark', PANEL_CUSTOM_THEME];

/** The colors of the Custom choice, in the order the picker shows them. */
export const PANEL_CUSTOM_COLOR_KEYS: ReadonlyArray<keyof CliPanelCustomColors> = ['background', 'foreground', 'accent'];

/** Whether `theme` is something the panel's theme picker offers. */
export function isPanelThemeChoice(theme: unknown): theme is string {
    return (
        typeof theme === 'string' &&
        (PANEL_THEME_MODES.includes(theme) || Object.prototype.hasOwnProperty.call(DefaultThemes, theme))
    );
}

/**
 * Load the theme the user picked in the panel from localStorage.
 * Returns null if none is saved or localStorage is unavailable.
 */
export function loadPanelTheme(): string | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (isPanelThemeChoice(stored)) return stored;
    } catch {
        // localStorage unavailable (SSR, security restrictions)
    }
    return null;
}

/** Save the theme the user picked in the panel; `null` forgets it. */
export function savePanelTheme(theme: string | null): void {
    try {
        if (theme === null) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        // localStorage unavailable
    }
}

/** `#rrggbb` in lower case (what a color input takes) for a hex color, or null for anything else. */
export function normalizeHexColor(color: unknown): string | null {
    if (typeof color !== 'string') return null;
    const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color);
    if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : null;
}

/** Custom colors with every color valid; invalid or missing ones come from `fallback`. */
export function normalizePanelCustomColors(colors: unknown, fallback: CliPanelCustomColors): CliPanelCustomColors {
    const source = (colors && typeof colors === 'object' ? colors : {}) as Record<string, unknown>;
    return {
        background: normalizeHexColor(source['background']) ?? fallback.background,
        foreground: normalizeHexColor(source['foreground']) ?? fallback.foreground,
        accent: normalizeHexColor(source['accent']) ?? fallback.accent,
    };
}

/** Load the colors of the Custom choice; null if none are saved. */
export function loadPanelCustomColors(): Partial<CliPanelCustomColors> | null {
    try {
        const stored = localStorage.getItem(COLORS_STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : null;
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        // localStorage unavailable, or not JSON
    }
    return null;
}

/** Save the colors of the Custom choice. They are kept when another theme is picked. */
export function savePanelCustomColors(colors: CliPanelCustomColors): void {
    try {
        localStorage.setItem(COLORS_STORAGE_KEY, JSON.stringify(colors));
    } catch {
        // localStorage unavailable
    }
}

/**
 * The panel theme of the Custom choice: the terminal takes the background, the
 * text and (as cursor and selection) the accent. Its other colors are those of
 * `terminal` (custom colors the user already had, e.g. from `theme set`), or the
 * ANSI colors of the light or dark terminal theme, whichever suits the background.
 */
export function customPanelTheme(colors: CliPanelCustomColors, terminal?: ITheme): CliPanelTheme {
    const base = terminal ?? (colorSchemeOf(colors.background) === 'light' ? DefaultThemes.light : DefaultThemes.default);
    return {
        terminal: {
            ...base,
            background: colors.background,
            foreground: colors.foreground,
            cursor: colors.accent,
            cursorAccent: colors.background,
            selectionBackground: `${colors.accent}55`,
        },
        colors: { accent: colors.accent, hoverBackground: `${colors.accent}1f`, activeBackground: `${colors.accent}33` },
    };
}

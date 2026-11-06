/**
 * Panel themes: the built-in light and dark palettes, panel colors derived from
 * a terminal theme, and the resolution of `CliPanelConfig.theme` into CSS custom
 * properties plus the terminal theme the panel's terminals use.
 */
import type { ITheme } from '@xterm/xterm';
import type { CliPanelColorScheme, CliPanelColors, CliPanelThemeInput } from '../models/options';
import { DefaultThemes } from '../themes/default-themes';

interface ThemeLike {
    background?: string;
    foreground?: string;
    cursor?: string;
    cyan?: string;
    blue?: string;
    magenta?: string;
    red?: string;
    selectionBackground?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const short = /^#?([0-9A-Fa-f])([0-9A-Fa-f])([0-9A-Fa-f])$/.exec(hex);
    if (short) hex = short.slice(1).map((c) => c + c).join('');
    const m = /^#?([0-9A-Fa-f]{6})([0-9A-Fa-f]{2})?$/.exec(hex);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function shiftColor(hex: string, amount: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const r = Math.min(255, Math.max(0, rgb.r + Math.round(amount)));
    const g = Math.min(255, Math.max(0, rgb.g + Math.round(amount)));
    const b = Math.min(255, Math.max(0, rgb.b + Math.round(amount)));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function hexToRgba(hex: string, alpha: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/** Light or dark, from a color's relative luminance; unknown formats count as dark. */
export function colorSchemeOf(color: string | undefined): CliPanelColorScheme {
    const rgb = color ? hexToRgb(color) : null;
    if (!rgb) return 'dark';
    const channel = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const luminance = 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
    return luminance > 0.4 ? 'light' : 'dark';
}

/** The built-in panel palettes, matching the `default` and `light` terminal themes. */
export const CliPanelPalettes: Readonly<Record<CliPanelColorScheme, Readonly<CliPanelColors>>> = Object.freeze({
    dark: Object.freeze({
        background: '#070b14',
        headerBackground: '#0f1623',
        border: '#1e293b',
        text: '#e2e8f0',
        textSecondary: '#94a3b8',
        accent: '#818cf8',
        hoverBackground: 'rgba(129, 140, 248, 0.12)',
        activeBackground: 'rgba(129, 140, 248, 0.22)',
        danger: '#f87171',
        shadow: 'rgba(0, 0, 0, 0.45)',
    }),
    // Soft grey paper instead of pure white, slate text rather than black: easier on the eyes
    light: Object.freeze({
        background: '#f7f8fa',
        headerBackground: '#eceff3',
        border: '#d9dee6',
        text: '#1e293b',
        textSecondary: '#5b6577',
        accent: '#4f46e5',
        hoverBackground: 'rgba(30, 41, 59, 0.06)',
        activeBackground: 'rgba(79, 70, 229, 0.12)',
        danger: '#c93c37',
        shadow: 'rgba(15, 23, 42, 0.12)',
    }),
});

/** The terminal theme of each built-in palette. */
const PALETTE_TERMINALS: Record<CliPanelColorScheme, ITheme> = {
    dark: DefaultThemes.default,
    light: DefaultThemes.light,
};

/** Panel colors that match a terminal theme. */
export function derivePanelColors(theme: ThemeLike): CliPanelColors {
    const scheme = colorSchemeOf(theme.background);
    const palette = CliPanelPalettes[scheme];
    const bg = theme.background || palette.background;
    const fg = theme.foreground || palette.text;
    const accent = theme.cyan || theme.blue || theme.magenta || palette.accent;
    const light = scheme === 'light';
    return {
        background: bg,
        headerBackground: shiftColor(bg, light ? -8 : 12),
        border: shiftColor(bg, light ? -28 : 24),
        text: fg,
        textSecondary: hexToRgba(fg, 0.65),
        accent,
        hoverBackground: hexToRgba(accent, light ? 0.1 : 0.12),
        activeBackground: hexToRgba(accent, light ? 0.16 : 0.2),
        danger: theme.red || palette.danger,
        shadow: palette.shadow,
    };
}

/** CSS custom properties of the panel for a set of colors. */
export function panelColorStyles(colors: CliPanelColors): Record<string, string> {
    return {
        '--cli-panel-bg': colors.background,
        '--cli-panel-header-bg': colors.headerBackground,
        '--cli-panel-border': colors.border,
        '--cli-panel-text': colors.text,
        '--cli-panel-text-secondary': colors.textSecondary,
        '--cli-panel-accent': colors.accent,
        '--cli-btn-hover-bg': colors.hoverBackground,
        '--cli-btn-active-bg': colors.activeBackground,
        '--cli-panel-danger': colors.danger,
        '--cli-panel-shadow': colors.shadow,
    };
}

/**
 * Derive CSS custom properties for the CLI panel from the active xterm theme.
 * Returns a record of property name → value that can be applied as inline styles.
 */
export function derivePanelThemeStyles(theme: ThemeLike): Record<string, string> {
    return {
        ...panelColorStyles(derivePanelColors(theme)),
        'color-scheme': colorSchemeOf(theme.background),
    };
}

/** A panel theme resolved for one moment (the system's color scheme). */
export interface CliResolvedPanelTheme {
    scheme: CliPanelColorScheme;
    /** CSS custom properties (and `color-scheme`) for the panel's elements. */
    styles: Record<string, string>;
    /** Theme of the panel's terminals. */
    terminal: ITheme;
}

/**
 * Resolve `CliPanelConfig.theme`. `prefersDark` decides `'auto'`;
 * `themes` are the terminal themes a name can refer to.
 */
export function resolvePanelTheme(
    input: CliPanelThemeInput | undefined,
    prefersDark: boolean,
    themes: Record<string, ITheme> = DefaultThemes,
): CliResolvedPanelTheme {
    const pick = (scheme: CliPanelColorScheme | 'auto'): CliPanelColorScheme =>
        scheme === 'auto' ? (prefersDark ? 'dark' : 'light') : scheme;
    const lookup = (name: string): ITheme | undefined => themes[name];

    let scheme: CliPanelColorScheme;
    let terminal: ITheme;
    let colors: CliPanelColors;
    let font: string | undefined;
    let radius: string | undefined;

    if (input === undefined || input === 'dark' || input === 'light' || input === 'auto') {
        scheme = pick((input as CliPanelColorScheme | 'auto' | undefined) ?? 'dark');
        terminal = PALETTE_TERMINALS[scheme];
        colors = { ...CliPanelPalettes[scheme] };
    } else if (typeof input === 'string') {
        const named = lookup(input);
        terminal = named ?? PALETTE_TERMINALS.dark;
        scheme = colorSchemeOf(terminal.background);
        colors = named ? derivePanelColors(named) : { ...CliPanelPalettes.dark };
    } else {
        const custom = typeof input.terminal === 'string' ? lookup(input.terminal) : input.terminal;
        scheme = input.base ? pick(input.base) : custom ? colorSchemeOf(custom.background) : 'dark';
        terminal = custom ?? PALETTE_TERMINALS[scheme];
        colors = custom ? derivePanelColors(custom) : { ...CliPanelPalettes[scheme] };
        if (input.colors) colors = { ...colors, ...stripUndefined(input.colors) };
        font = input.fontFamily;
        radius = input.radius;
    }

    const styles: Record<string, string> = { ...panelColorStyles(colors), 'color-scheme': scheme };
    if (font) styles['--cli-panel-font'] = font;
    if (radius) styles['--cli-panel-radius'] = radius;
    return { scheme, styles, terminal };
}

function stripUndefined<T extends object>(value: T): Partial<T> {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Whether the system prefers dark colors (true without a browser). */
export function prefersDarkScheme(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

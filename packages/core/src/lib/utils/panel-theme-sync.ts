/**
 * Derives CLI panel CSS custom property values from an xterm ITheme object.
 * Used when `syncTheme` is enabled on the panel config.
 */

interface ThemeLike {
    background?: string;
    foreground?: string;
    cursor?: string;
    cyan?: string;
    blue?: string;
    magenta?: string;
    selectionBackground?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
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

/** Default dark background when no theme background is set */
const DEFAULT_BG = '#111827';
/** Default foreground when no theme foreground is set */
const DEFAULT_FG = '#ffffff';
/** Default accent color when no theme cyan/blue/magenta is set */
const DEFAULT_ACCENT = '#818cf8';

/**
 * Derive CSS custom properties for the CLI panel from the active xterm theme.
 * Returns a record of property name → value that can be applied as inline styles.
 */
export function derivePanelThemeStyles(theme: ThemeLike): Record<string, string> {
    const bg = theme.background || DEFAULT_BG;
    const fg = theme.foreground || DEFAULT_FG;
    const accent = theme.cyan || theme.blue || theme.magenta || DEFAULT_ACCENT;

    return {
        '--cli-panel-bg': bg,
        '--cli-panel-header-bg': shiftColor(bg, 12),
        '--cli-panel-border': shiftColor(bg, 24),
        '--cli-panel-text': fg,
        '--cli-panel-text-secondary': hexToRgba(fg, 0.6),
        '--cli-panel-accent': accent,
        '--cli-btn-hover-bg': hexToRgba(accent, 0.12),
        '--cli-btn-active-bg': hexToRgba(accent, 0.2),
    };
}

import type { ITheme, Terminal } from '@xterm/xterm';

/**
 * The theme of one terminal: the base the host gave it (or the terminal's
 * initial theme) and whether the user replaced it with the `theme` command.
 * The theme processor is shared by every engine on a page, so this lives per
 * terminal rather than on the processor.
 */
interface TerminalThemeRecord {
    base: ITheme;
    userChosen: boolean;
}

const records = new WeakMap<Terminal, TerminalThemeRecord>();

function recordOf(terminal: Terminal): TerminalThemeRecord {
    let record = records.get(terminal);
    if (!record) {
        record = { base: terminal.options.theme ?? {}, userChosen: false };
        records.set(terminal, record);
    }
    return record;
}

/**
 * Fired (bubbling) on a terminal's container whenever its theme changes; the
 * detail is the new `ITheme`. Panels restyle themselves from it, even before
 * the terminal's engine has finished starting.
 */
export const CLI_TERMINAL_THEME_EVENT = 'qcli-terminal-theme';

/** Paint the element around the terminal with its background color and announce the theme. */
export function paintTerminalBackground(terminal: Terminal): void {
    const container = terminal.element?.closest<HTMLElement>('.terminal-container');
    if (!container) return;
    const theme = terminal.options.theme ?? {};
    container.style.background = theme.background ?? '';
    if (typeof CustomEvent === 'function') {
        container.dispatchEvent(new CustomEvent(CLI_TERMINAL_THEME_EVENT, { bubbles: true, detail: theme }));
    }
}

/**
 * The host's theme for a terminal (see `CliEngine.setTheme`). It becomes the
 * terminal's base theme and is shown unless the user chose a theme of their own.
 */
export function setHostTerminalTheme(terminal: Terminal, theme: ITheme): void {
    const record = recordOf(terminal);
    record.base = theme;
    if (!record.userChosen) {
        terminal.options.theme = theme;
        paintTerminalBackground(terminal);
    }
}

/** The theme `theme reset` returns to. */
export function baseTerminalTheme(terminal: Terminal): ITheme {
    return recordOf(terminal).base;
}

/** Show a theme the user chose; host themes no longer replace it. */
export function applyUserTerminalTheme(terminal: Terminal, theme: ITheme): void {
    recordOf(terminal).userChosen = true;
    terminal.options.theme = theme;
    paintTerminalBackground(terminal);
}

/** Forget the user's theme and show the base theme again. */
export function resetTerminalTheme(terminal: Terminal): void {
    const record = recordOf(terminal);
    record.userChosen = false;
    terminal.options.theme = { ...record.base };
    paintTerminalBackground(terminal);
}

/** Show a theme for a moment (the live preview of `theme apply`). */
export function previewTerminalTheme(terminal: Terminal, theme: ITheme): void {
    terminal.options.theme = theme;
    paintTerminalBackground(terminal);
}

/** Record the terminal's current theme as its base, unless the host already set one. */
export function initTerminalTheme(terminal: Terminal): void {
    recordOf(terminal);
}

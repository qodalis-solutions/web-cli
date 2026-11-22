import { Terminal } from '@xterm/xterm';
import {
    clearTerminalLine,
    CliForegroundColor,
    colorFirstWord,
    ICliTerminalWriter,
} from '@qodalis/cli-core';

export interface PromptOptions {
    userName?: string;
    hideUserName?: boolean;
    /**
     * Shown (dimmed) instead of the user name when an auth module is loaded
     * but nobody is signed in, e.g. `anonymous:/$`. Empty/undefined: nothing.
     */
    anonymousName?: string;
    contextProcessor?: string;
    pathProvider?: () => string | null;
    /** The user's home directory, shown as `~` on a narrow terminal. */
    homeDir?: string;
}

/** Terminals narrower than this (phones) get a shortened user name. */
export const NARROW_PROMPT_COLS = 60;

/** Longest user name shown in full on a narrow terminal. */
const NARROW_USER_NAME_MAX = 16;

/**
 * The user name to show in the prompt: on a narrow terminal a long name is
 * shortened, so the prompt leaves room for the command. An email keeps the
 * start of its local part and its domain (`nicolae***@gmail.com`).
 */
export function shortenPromptUserName(name: string, cols: number): string {
    if (cols >= NARROW_PROMPT_COLS || name.length <= NARROW_USER_NAME_MAX) {
        return name;
    }
    const at = name.indexOf('@');
    if (at > 0) {
        const local = name.slice(0, at);
        const domain = name.slice(at + 1);
        const shortLocal = local.length > 7 ? `${local.slice(0, 7)}***` : local;
        const short = `${shortLocal}@${domain}`;
        if (short.length <= NARROW_USER_NAME_MAX + 8) return short;
        return `${shortLocal}@***`;
    }
    return `${name.slice(0, NARROW_USER_NAME_MAX - 3)}***`;
}

/**
 * The path to show in the prompt: on a narrow terminal the user's home
 * directory is written `~`, as shells do (`~/projects`).
 */
export function shortenPromptPath(
    path: string,
    homeDir: string | undefined,
    cols: number,
): string {
    if (cols >= NARROW_PROMPT_COLS || !homeDir || homeDir === '/') {
        return path;
    }
    const home = homeDir.replace(/\/+$/, '');
    if (path === home) return '~';
    if (path.startsWith(`${home}/`)) return `~${path.slice(home.length)}`;
    return path;
}

/**
 * Handles prompt rendering and line display for the CLI.
 * Encapsulates all terminal escape sequences for line editing.
 *
 * A prompt with a long command wraps over several rows. The renderer keeps
 * the row the cursor is on (counted from the prompt's first row), so a
 * redraw can go back to the prompt's start wherever the cursor is.
 */
export class CliTerminalLineRenderer {
    /** Row of the cursor below the prompt's first row; `null`: unknown. */
    private cursorRow: number | null = null;

    constructor(
        private readonly terminal: Terminal,
        private readonly writer: ICliTerminalWriter,
    ) {}

    /**
     * Builds the prompt string (user:path$ ) with ANSI color codes.
     */
    getPromptString(options: PromptOptions): string {
        const name = shortenPromptUserName(
            options.userName ?? '',
            this.terminal.cols,
        );
        let promptStart = options.hideUserName
            ? ''
            : name
              ? `\x1b[32m${name}\x1b[0m:`
              : options.anonymousName
                ? `\x1b[90m${options.anonymousName}\x1b[0m:`
                : '';

        if (options.contextProcessor) {
            promptStart = `${options.contextProcessor}`;
        }

        const rawPath = options.pathProvider?.() ?? null;
        const path =
            rawPath !== null
                ? shortenPromptPath(
                      rawPath,
                      options.homeDir,
                      this.terminal.cols,
                  )
                : null;
        const pathSegment =
            path !== null ? `\x1b[34m${path}\x1b[0m` : '\x1b[34m~\x1b[0m';
        return `${promptStart}${pathSegment}$ `;
    }

    /**
     * Writes the prompt to the terminal and returns the visible prompt length
     * (number of columns the prompt occupies).
     */
    renderPrompt(options: PromptOptions): number {
        const promptString = this.getPromptString(options);
        // terminal.write() is async so cursorX is unreliable here.
        const promptLength = visibleLength(promptString);
        this.terminal.write(promptString + this.wrapAtEdge(promptLength));
        this.cursorRow = Math.floor(promptLength / this.terminal.cols);
        return promptLength;
    }

    /** Visible length (columns) of a prompt string. */
    getPromptLength(options: PromptOptions): number {
        return visibleLength(this.getPromptString(options));
    }

    /**
     * Set the cursor's row below the prompt's first row, when something
     * else moved it: after a resize (xterm reflowed the rows) or after the
     * prompt was written directly.
     */
    setCursorRow(row: number): void {
        this.cursorRow = Math.max(0, row);
    }

    /**
     * Clears and redraws the current line (prompt + user input + cursor positioning).
     *
     * `previousContentLength` is used only when the cursor's row is not
     * known yet (nothing rendered through this renderer): the cursor is then
     * taken to be at the end of that content.
     */
    refreshLine(
        currentLine: string,
        cursorPosition: number,
        promptLength: number,
        promptString: string,
        previousContentLength?: number,
    ): void {
        const contentLength = promptLength + currentLine.length;
        const cols = this.terminal.cols;
        const rowsUp =
            this.cursorRow ??
            Math.max(
                0,
                Math.ceil(
                    Math.max(contentLength, previousContentLength ?? 0) / cols,
                ) - 1,
            );

        let output = '';

        // 1. Move cursor up to the first line of content, then clear
        //    everything from there to end of screen. Using \x1b[J instead
        //    of clearing individual lines avoids stale artifacts left by
        //    xterm reflow (e.g. after browser zoom changes).
        if (rowsUp > 0) {
            output += `\x1b[${rowsUp}A`;
        }
        output += '\r\x1b[J';

        // 2. Prompt
        output += promptString;

        // 3. Current line with syntax coloring
        output += colorFirstWord(
            currentLine,
            (word) =>
                this.writer.wrapInColor(word, CliForegroundColor.Yellow) ??
                currentLine,
        );
        output += this.wrapAtEdge(contentLength);

        // 4. Cursor positioning: rows and columns, since moving left does
        //    not cross into the row above
        output += this.moveCursor(contentLength, promptLength + cursorPosition);
        this.cursorRow = Math.floor((promptLength + cursorPosition) / cols);

        this.terminal.write(output);
    }

    /**
     * Show `ghost` (a dimmed completion) after the input, leaving the cursor
     * where it is, at the end of the input.
     */
    renderGhostText(ghost: string, contentLength: number): void {
        if (!ghost) return;
        const end = contentLength + ghost.length;
        this.terminal.write(
            `\x1b[2m\x1b[38;5;240m${ghost}\x1b[0m` +
                this.wrapAtEdge(end) +
                this.moveCursor(end, contentLength),
        );
    }

    /**
     * After writing up to `end` columns exactly at the right edge, xterm
     * keeps the cursor on that row until the next character. Moving on to
     * the next row makes the cursor's row `floor(end / cols)` in all cases.
     */
    private wrapAtEdge(end: number): string {
        return end > 0 && end % this.terminal.cols === 0 ? ' \r' : '';
    }

    /** Escape codes moving the cursor from column `from` to `to` (`to` <= `from`). */
    private moveCursor(from: number, to: number): string {
        if (from === to) return '';
        const cols = this.terminal.cols;
        const rowsUp = Math.floor(from / cols) - Math.floor(to / cols);
        const column = to % cols;
        return (
            (rowsUp > 0 ? `\x1b[${rowsUp}A` : '') +
            '\r' +
            (column > 0 ? `\x1b[${column}C` : '')
        );
    }

    /**
     * Clears the current terminal line.
     */
    clearLine(contentLength: number): void {
        clearTerminalLine(this.terminal, contentLength);
        this.cursorRow = null;
    }

    /**
     * The cursor left the prompt (the command was submitted): its row is
     * unknown until the next prompt is rendered.
     */
    endLine(): void {
        this.cursorRow = null;
    }
}

function visibleLength(text: string): number {
    return text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').length;
}

import { Terminal } from '@xterm/xterm';
import { NanoEditorBuffer } from './nano-editor-buffer';
import { SyntaxHighlightEngine } from './syntax/engine';

/**
 * Renders the nano-style editor UI to an xterm.js terminal.
 * Uses alternate screen buffer to preserve scroll history.
 */
export class NanoEditorRenderer {
    highlightEngine?: SyntaxHighlightEngine;

    constructor(private readonly terminal: Terminal) {}

    /** Enter alternate screen buffer and hide default cursor. */
    enterAlternateScreen(): void {
        this.terminal.write('\x1b[?1049h');
        this.terminal.write('\x1b[?25l');
    }

    /** Leave alternate screen buffer and restore cursor. */
    leaveAlternateScreen(): void {
        this.terminal.write('\x1b[?25h');
        this.terminal.write('\x1b[?1049l');
    }

    /** Get the number of content rows available (total rows minus title and status bars). */
    get contentHeight(): number {
        return this.terminal.rows - 3;
    }

    /** Full redraw of the editor screen. */
    render(
        buffer: NanoEditorBuffer,
        fileName: string,
        statusMessage?: string,
    ): void {
        const { rows, cols } = this.terminal;

        buffer.ensureVisible(this.contentHeight);

        let output = '\x1b[?25l';

        // Title bar (row 1)
        output += '\x1b[H';
        output += this.renderTitleBar(fileName, buffer.dirty, cols);

        // Content area (rows 2 to rows-2)
        for (let i = 0; i < this.contentHeight; i++) {
            const lineIdx = buffer.scrollOffset + i;
            output += `\x1b[${i + 2};1H`;
            output += '\x1b[2K';

            if (lineIdx < buffer.lines.length) {
                const line = buffer.lines[lineIdx];
                if (this.highlightEngine) {
                    output += this.highlightEngine.renderLine(lineIdx, line, cols);
                } else {
                    output += line.length > cols ? line.slice(0, cols) : line;
                }
            }
        }

        // Shortcut bar (row rows-1) and status bar (row rows)
        output += `\x1b[${rows - 1};1H`;
        output += this.renderShortcutBar(cols);
        output += `\x1b[${rows};1H`;
        output += this.renderStatusBar(statusMessage, cols);

        // Position cursor
        const screenRow = buffer.cursorRow - buffer.scrollOffset + 2;
        const screenCol = buffer.cursorCol + 1;
        output += `\x1b[${screenRow};${screenCol}H`;
        output += '\x1b[?25h';

        this.terminal.write(output);
    }

    /** Render just the status bar (for transient messages). */
    renderStatusOnly(buffer: NanoEditorBuffer, statusMessage: string): void {
        const { rows, cols } = this.terminal;

        let output = `\x1b[${rows};1H`;
        output += this.renderStatusBar(statusMessage, cols);

        const screenRow = buffer.cursorRow - buffer.scrollOffset + 2;
        const screenCol = buffer.cursorCol + 1;
        output += `\x1b[${screenRow};${screenCol}H`;

        this.terminal.write(output);
    }

    /** Render the help screen. */
    renderHelp(): void {
        const { rows, cols } = this.terminal;

        const helpLines = [
            '',
            '  CLI Nano Help',
            '',
            '  Main shortcuts:',
            '',
            '  ^G  Help        ^O  Write Out   ^F  Search       ^K  Cut Line',
            '  ^X  Exit        ^R  Read File    ^\\  Replace      ^U  Paste Line',
            '',
            '  Navigation:',
            '',
            '  ^A  Home        ^E  End          ^Y  Page Up      ^V  Page Down',
            '  ^P  Prev Line   ^N  Next Line    Arrow Keys       ^B  Backward',
            '',
            '  Other:',
            '',
            '  ^C  Cur Pos     ^S  Save (alt)   ^J  Justify      ^T  To Spell',
            '',
            '  Arrow keys, Home, End, Page Up, Page Down also work.',
            '',
            '',
            '  [ Press any key to return ]',
        ];

        let output = '\x1b[?25l\x1b[H';

        // Title
        const title = '  CLI Nano Help';
        output += `\x1b[7m${title.padEnd(cols)}\x1b[0m`;

        for (let i = 0; i < rows - 2; i++) {
            output += `\x1b[${i + 2};1H\x1b[2K`;
            if (i < helpLines.length) {
                output += helpLines[i].slice(0, cols);
            }
        }

        // Bottom bar
        output += `\x1b[${rows};1H`;
        output += `\x1b[7m${'  [ Press any key to return ]'.padEnd(cols)}\x1b[0m`;

        this.terminal.write(output);
    }

    private renderTitleBar(
        fileName: string,
        dirty: boolean,
        cols: number,
    ): string {
        const title = `  CLI Nano  ${fileName || 'New Buffer'}${dirty ? ' (modified)' : ''}`;
        const padded = title.padEnd(cols);
        return `\x1b[7m${padded}\x1b[0m`;
    }

    private renderShortcutBar(cols: number): string {
        const shortcuts =
            '^G Help  ^O Write Out  ^F Search    ^K Cut     ^C Cur Pos';
        const padded = shortcuts.padEnd(cols);
        return `\x1b[7m${padded}\x1b[0m`;
    }

    private renderStatusBar(
        statusMessage: string | undefined,
        cols: number,
    ): string {
        const text =
            statusMessage ||
            '^X Exit  ^R Read File  ^\\  Replace   ^U Paste   ^S Save';
        const padded = text.padEnd(cols);
        return `\x1b[7m${padded}\x1b[0m`;
    }
}

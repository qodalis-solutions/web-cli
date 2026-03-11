import { Terminal } from '@xterm/xterm';

/**
 * Clears the current line in the terminal, accounting for text that wraps across multiple lines.
 * @param terminal The xterm terminal instance
 * @param contentLength The total visible character count on the line (prompt + text)
 */
export const clearTerminalLine = (
    terminal: Terminal,
    contentLength: number,
): void => {
    const lines = Math.max(1, Math.ceil(contentLength / terminal.cols));

    for (let i = 0; i < lines; i++) {
        terminal.write('\x1b[2K');
        if (i < lines - 1) {
            terminal.write('\x1b[A');
        }
    }

    terminal.write('\r');
};

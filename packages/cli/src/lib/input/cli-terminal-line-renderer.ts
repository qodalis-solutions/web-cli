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
    contextProcessor?: string;
    pathProvider?: () => string | null;
}

/**
 * Handles prompt rendering and line display for the CLI.
 * Encapsulates all terminal escape sequences for line editing.
 */
export class CliTerminalLineRenderer {
    constructor(
        private readonly terminal: Terminal,
        private readonly writer: ICliTerminalWriter,
    ) {}

    /**
     * Builds the prompt string (user:path$ ) with ANSI color codes.
     */
    getPromptString(options: PromptOptions): string {
        let promptStart = options.hideUserName
            ? ''
            : `\x1b[32m${options.userName ?? ''}\x1b[0m:`;

        if (options.contextProcessor) {
            promptStart = `${options.contextProcessor}`;
        }

        const path = options.pathProvider?.() ?? null;
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
        this.terminal.write(promptString);
        // Calculate visible length by stripping ANSI escape codes.
        // terminal.write() is async so cursorX is unreliable here.
        // eslint-disable-next-line no-control-regex
        return promptString.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').length;
    }

    /**
     * Clears and redraws the current line (prompt + user input + cursor positioning).
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
        const clearLength =
            previousContentLength !== undefined
                ? Math.max(contentLength, previousContentLength)
                : contentLength;
        const lines = Math.max(1, Math.ceil(clearLength / cols));

        let output = '';

        // 1. Move cursor up to the first line of content, then clear
        //    everything from there to end of screen. Using \x1b[J instead
        //    of clearing individual lines avoids stale artifacts left by
        //    xterm reflow (e.g. after browser zoom changes).
        for (let i = 1; i < lines; i++) {
            output += '\x1b[A';
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

        // 4. Cursor positioning
        const cursorOffset = currentLine.length - cursorPosition;
        if (cursorOffset > 0) {
            output += `\x1b[${cursorOffset}D`;
        }

        this.terminal.write(output);
    }

    /**
     * Clears the current terminal line.
     */
    clearLine(contentLength: number): void {
        clearTerminalLine(this.terminal, contentLength);
    }
}

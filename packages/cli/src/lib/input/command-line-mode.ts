import { IInputMode } from './input-mode';
import { CliLineBuffer } from './cli-line-buffer';
import {
    CliTerminalLineRenderer,
    PromptOptions,
} from './cli-terminal-line-renderer';
import { CliCompletionEngine } from '../completion/cli-completion-engine';
import { CliCommandHistory } from '../services/cli-command-history';
import { Terminal } from '@xterm/xterm';
import {
    ICliCommandExecutorService,
    ICliExecutionContext,
} from '@qodalis/cli-core';

/**
 * Host interface for CommandLineMode — provides access to
 * the execution context's services without a circular dependency.
 */
export interface CommandLineModeHost {
    readonly terminal: Terminal;
    readonly lineBuffer: CliLineBuffer;
    readonly lineRenderer: CliTerminalLineRenderer;
    readonly completionEngine: CliCompletionEngine;
    readonly commandHistory: CliCommandHistory;
    getPromptOptions(): PromptOptions;
    getPromptLength(): number;
    setPromptLength(value: number): void;
    getExecutionContext(): ICliExecutionContext;
    isProgressRunning(): boolean;
    isRawModeActive(): boolean;
    abort(): void;
    showPrompt(options?: {
        reset?: boolean;
        newLine?: boolean;
        keepCurrentLine?: boolean;
    }): void;
}

export class CommandLineMode implements IInputMode {
    private historyIndex = 0;
    private isExecutingCommand = false;
    private selectionStart: { x: number; y: number } | null = null;
    private selectionEnd: { x: number; y: number } | null = null;
    private ghostText = '';
    private ghostDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    /** Non-null while the user is doing prefix-based history search (Up arrow with text in buffer). */
    private historySearchPrefix: string | null = null;
    /** True when the buffer text was set by history navigation (not typed by user). */
    private bufferSetByHistory = false;

    constructor(private readonly host: CommandLineModeHost) {}

    activate(): void {
        this.host.commandHistory.initialize().then(() => {
            this.historyIndex = this.host.commandHistory.getLastIndex();
        });
    }

    async handleInput(data: string): Promise<void> {
        const buffer = this.host.lineBuffer;

        if (data === '\u0009') {
            this.clearGhostText();
            await this.handleTabCompletion();
            return;
        }

        this.host.completionEngine.resetState();

        if (data === '\r') {
            this.clearGhostText();
            this.host.terminal.write('\r\n');

            if (buffer.text) {
                await this.host.commandHistory.addCommand(buffer.text);
                this.historyIndex = this.host.commandHistory.getLastIndex();
                this.bufferSetByHistory = false;

                this.isExecutingCommand = true;
                const ctx = this.host.getExecutionContext();
                await ctx.executor.executeCommand(buffer.text, ctx);
                this.isExecutingCommand = false;
            }

            if (!this.host.isRawModeActive()) {
                this.host.showPrompt();
            }
        } else if (data === '\u001B[A') {
            this.showPreviousCommand();
        } else if (data === '\u001B[B') {
            this.showNextCommand();
        } else if (data === '\u001B[D') {
            if (buffer.cursorPosition > 0) {
                buffer.moveCursorLeft();
                this.host.terminal.write(data);
            }
        } else if (data === '\u001B[C') {
            if (this.ghostText && buffer.cursorPosition === buffer.text.length) {
                // Accept ghost text suggestion
                buffer.insert(this.ghostText);
                this.ghostText = '';
                this.refreshLine();
            } else if (buffer.cursorPosition < buffer.text.length) {
                buffer.moveCursorRight();
                this.host.terminal.write(data);
            }
        } else if (data === '\u007F') {
            this.handleBackspace();
        } else {
            this.handleInputText(data);
        }
    }

    handleKeyEvent(event: KeyboardEvent): boolean {
        if (event.code === 'KeyC' && event.ctrlKey) {
            this.host.abort();
            this.host.terminal.writeln('Ctrl+C');

            // Clear context processor if one is active (e.g. --context mode)
            this.host.getExecutionContext().setContextProcessor(undefined);

            if (!this.isExecutingCommand) {
                this.host.showPrompt();
            }

            return false;
        }

        if (event.code === 'Escape') {
            this.host.abort();
            this.host.showPrompt({ newLine: true });
            return false;
        }

        if (event.code === 'KeyV' && event.ctrlKey) {
            return false;
        }

        if (event.code === 'KeyL' && event.ctrlKey) {
            event.preventDefault();
            this.host.lineBuffer.clear();
            this.host.terminal.clear();
            this.host.showPrompt({ reset: true });
            return false;
        }

        if (
            event.shiftKey &&
            (event.code === 'ArrowLeft' || event.code === 'ArrowRight')
        ) {
            if (!this.selectionStart) {
                this.selectionStart = this.getTerminalCursorPosition();
            }

            const buffer = this.host.lineBuffer;
            if (event.code === 'ArrowLeft') {
                buffer.moveCursorLeft();
            } else {
                buffer.moveCursorRight();
            }

            this.selectionEnd = this.getTerminalCursorPosition();
            this.updateSelection();
            return false;
        } else {
            this.selectionStart = null;
        }

        return true;
    }

    private handleInputText(text: string): void {
        text = text.replace(/[\r\n\t]+/g, '');
        this.clearGhostText();
        this.clearHistorySearch();
        this.bufferSetByHistory = false;
        this.host.lineBuffer.insert(text);
        this.refreshLine();
        this.scheduleGhostText();
    }

    private clearGhostText(): void {
        this.ghostText = '';
        if (this.ghostDebounceTimer !== null) {
            clearTimeout(this.ghostDebounceTimer);
            this.ghostDebounceTimer = null;
        }
    }

    private scheduleGhostText(): void {
        this.ghostDebounceTimer = setTimeout(() => {
            this.computeAndShowGhostText();
        }, 120);
    }

    private async computeAndShowGhostText(): Promise<void> {
        const buffer = this.host.lineBuffer;
        if (!buffer.text || buffer.cursorPosition < buffer.text.length) return;

        try {
            const result = await this.host.completionEngine.completeSingle(
                buffer.text,
                buffer.cursorPosition,
            );
            if (result && result.startsWith(buffer.text)) {
                this.ghostText = result.slice(buffer.text.length);
                this.renderGhostText();
            }
        } catch {
            // silently ignore completion errors
        }
    }

    private handleBackspace(): void {
        const buffer = this.host.lineBuffer;
        this.clearGhostText();
        this.clearHistorySearch();
        if (buffer.cursorPosition > 0) {
            buffer.deleteCharBefore();
            this.refreshLine();
        }
    }

    private async handleTabCompletion(): Promise<void> {
        const buffer = this.host.lineBuffer;
        const result = await this.host.completionEngine.complete(
            buffer.text,
            buffer.cursorPosition,
        );

        switch (result.action) {
            case 'complete': {
                const { replacement, tokenStart, token } = result;
                if (
                    replacement === undefined ||
                    tokenStart === undefined ||
                    token === undefined
                ) {
                    break;
                }

                const before = buffer.text.slice(0, tokenStart);
                const after = buffer.text.slice(tokenStart + token.length);
                const suffix =
                    after.length === 0 && !replacement.endsWith('/') ? ' ' : '';
                buffer.setText(before + replacement + suffix + after);
                buffer.cursorPosition =
                    tokenStart + replacement.length + suffix.length;
                this.refreshLine();
                break;
            }
            case 'show-candidates': {
                const candidates = result.candidates ?? [];
                if (candidates.length === 0) break;

                this.host.terminal.write('\r\n');

                const maxLen = Math.max(...candidates.map((c) => c.length));
                const cols = Math.max(
                    1,
                    Math.floor((this.host.terminal.cols || 80) / (maxLen + 2)),
                );
                let line = '';
                for (let i = 0; i < candidates.length; i++) {
                    line += candidates[i].padEnd(maxLen + 2);
                    if ((i + 1) % cols === 0) {
                        this.host.terminal.write(line + '\r\n');
                        line = '';
                    }
                }
                if (line) {
                    this.host.terminal.write(line + '\r\n');
                }

                const promptStr = this.host.lineRenderer.getPromptString(
                    this.host.getPromptOptions(),
                );
                this.host.terminal.write(promptStr);
                this.host.setPromptLength(
                    this.host.terminal.buffer.active.cursorX,
                );
                this.host.terminal.write(buffer.text);

                const charsAfterCursor =
                    buffer.text.length - buffer.cursorPosition;
                if (charsAfterCursor > 0) {
                    this.host.terminal.write(`\x1b[${charsAfterCursor}D`);
                }
                break;
            }
        }
    }

    private showPreviousCommand(): void {
        this.clearGhostText();
        const buffer = this.host.lineBuffer;

        // If the buffer has user-typed text and we haven't started a prefix search, begin one.
        if (buffer.text && !this.bufferSetByHistory && this.historySearchPrefix === null) {
            this.historySearchPrefix = buffer.text;
            this.historyIndex = this.host.commandHistory.getLastIndex();
        }

        if (this.historySearchPrefix !== null) {
            const found = this.host.commandHistory.searchBackward(
                this.historySearchPrefix,
                this.historyIndex,
            );
            if (found !== -1) {
                this.historyIndex = found;
                this.displayCommandFromHistory();
            }
            return;
        }

        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.displayCommandFromHistory();
        }
    }

    private showNextCommand(): void {
        this.clearGhostText();
        const buffer = this.host.lineBuffer;

        if (this.historySearchPrefix !== null) {
            const found = this.host.commandHistory.searchForward(
                this.historySearchPrefix,
                this.historyIndex,
            );
            if (found !== -1) {
                this.historyIndex = found;
                this.displayCommandFromHistory();
            } else {
                // Restore the original search prefix in the buffer
                const previousContentLength =
                    this.host.getPromptLength() + buffer.text.length;
                const prefix = this.historySearchPrefix;
                this.clearHistorySearch();
                buffer.setText(prefix);
                this.refreshLine(previousContentLength);
            }
            return;
        }

        if (this.historyIndex < this.host.commandHistory.getLastIndex() - 1) {
            this.historyIndex++;
            this.displayCommandFromHistory();
        } else {
            this.historyIndex = this.host.commandHistory.getLastIndex();
            const previousContentLength =
                this.host.getPromptLength() + buffer.text.length;
            buffer.clear();
            this.refreshLine(previousContentLength);
        }
    }

    private clearHistorySearch(): void {
        this.historySearchPrefix = null;
        this.bufferSetByHistory = false;
        this.historyIndex = this.host.commandHistory.getLastIndex();
    }

    private displayCommandFromHistory(): void {
        const buffer = this.host.lineBuffer;
        const previousContentLength =
            this.host.getPromptLength() + buffer.text.length;
        const cmd =
            this.host.commandHistory.getCommand(this.historyIndex) || '';
        buffer.setText(cmd);
        this.bufferSetByHistory = true;
        this.refreshLine(previousContentLength);
    }

    private refreshLine(previousContentLength?: number): void {
        const promptStr = this.host.lineRenderer.getPromptString(
            this.host.getPromptOptions(),
        );
        this.host.lineRenderer.refreshLine(
            this.host.lineBuffer.text,
            this.host.lineBuffer.cursorPosition,
            this.host.getPromptLength(),
            promptStr,
            previousContentLength,
        );
        this.renderGhostText();
    }

    private renderGhostText(): void {
        if (!this.ghostText) return;
        const buffer = this.host.lineBuffer;
        // Only show ghost text when cursor is at end of input
        if (buffer.cursorPosition < buffer.text.length) return;
        const ghost = this.ghostText;
        this.host.terminal.write(
            `\x1b[2m\x1b[38;5;240m${ghost}\x1b[0m\x1b[${ghost.length}D`,
        );
    }

    private getTerminalCursorPosition(): { x: number; y: number } {
        const x: number = (this.host.terminal as any)._core.buffer.x;
        const y: number = (this.host.terminal as any)._core.buffer.y;
        return { x, y };
    }

    private updateSelection(): void {
        if (this.selectionStart && this.selectionEnd) {
            const startRow = Math.min(
                this.selectionStart.y,
                this.selectionEnd.y,
            );
            const endRow = Math.max(this.selectionStart.y, this.selectionEnd.y);

            if (startRow === endRow) {
                const startCol = Math.min(
                    this.selectionStart.x,
                    this.selectionEnd.x,
                );
                const endCol = Math.max(
                    this.selectionStart.x,
                    this.selectionEnd.x,
                );
                this.host.terminal.select(
                    startCol,
                    startRow,
                    Math.abs(endCol - startCol),
                );
            } else {
                this.host.terminal.selectLines(startRow, endRow);
            }
        }
    }
}

# Input Pipeline Refactoring — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Break the 800-line `CliExecutionContext` god class into focused components (CliLineBuffer, IInputMode modes, CliTerminalLineRenderer) while preserving the public `ICliExecutionContext` interface unchanged.

**Architecture:** Extract a reusable `CliLineBuffer` for text editing (eliminating 4× duplication), an `IInputMode` interface with three mode classes (`CommandLineMode`, `ReaderMode`, `RawMode`) for input routing, and a `CliTerminalLineRenderer` for prompt/line display. `CliExecutionContext` becomes a thin facade that delegates to these components via a mode stack.

**Tech Stack:** TypeScript, xterm.js (Terminal), Jasmine (tests), Angular library (build via `ng build cli`)

---

### Task 1: CliLineBuffer — Reusable Text Buffer

**Files:**
- Create: `projects/cli/src/lib/input/cli-line-buffer.ts`
- Create: `projects/cli/src/lib/input/cli-line-buffer.spec.ts`

**Step 1: Write the failing tests**

Create `projects/cli/src/lib/input/cli-line-buffer.spec.ts`:

```typescript
import { CliLineBuffer } from './cli-line-buffer';

describe('CliLineBuffer', () => {
    let buffer: CliLineBuffer;

    beforeEach(() => {
        buffer = new CliLineBuffer();
    });

    it('should start empty', () => {
        expect(buffer.text).toBe('');
        expect(buffer.cursorPosition).toBe(0);
    });

    it('should insert text at cursor', () => {
        buffer.insert('hello');
        expect(buffer.text).toBe('hello');
        expect(buffer.cursorPosition).toBe(5);
    });

    it('should insert text at mid-cursor position', () => {
        buffer.insert('hllo');
        buffer.cursorPosition = 1;
        buffer.insert('e');
        expect(buffer.text).toBe('hello');
        expect(buffer.cursorPosition).toBe(2);
    });

    it('should handle backspace (deleteCharBefore)', () => {
        buffer.insert('hello');
        buffer.deleteCharBefore();
        expect(buffer.text).toBe('hell');
        expect(buffer.cursorPosition).toBe(4);
    });

    it('should not backspace at position 0', () => {
        buffer.insert('hello');
        buffer.cursorPosition = 0;
        buffer.deleteCharBefore();
        expect(buffer.text).toBe('hello');
        expect(buffer.cursorPosition).toBe(0);
    });

    it('should handle delete key (deleteCharAt)', () => {
        buffer.insert('hello');
        buffer.cursorPosition = 1;
        buffer.deleteCharAt();
        expect(buffer.text).toBe('hllo');
        expect(buffer.cursorPosition).toBe(1);
    });

    it('should not delete at end of text', () => {
        buffer.insert('hello');
        buffer.deleteCharAt();
        expect(buffer.text).toBe('hello');
    });

    it('should move cursor left', () => {
        buffer.insert('hello');
        buffer.moveCursorLeft();
        expect(buffer.cursorPosition).toBe(4);
    });

    it('should not move cursor left past 0', () => {
        buffer.moveCursorLeft();
        expect(buffer.cursorPosition).toBe(0);
    });

    it('should move cursor right', () => {
        buffer.insert('hello');
        buffer.cursorPosition = 2;
        buffer.moveCursorRight();
        expect(buffer.cursorPosition).toBe(3);
    });

    it('should not move cursor right past text length', () => {
        buffer.insert('hello');
        buffer.moveCursorRight();
        expect(buffer.cursorPosition).toBe(5);
    });

    it('should move to home', () => {
        buffer.insert('hello');
        buffer.moveHome();
        expect(buffer.cursorPosition).toBe(0);
    });

    it('should move to end', () => {
        buffer.insert('hello');
        buffer.cursorPosition = 0;
        buffer.moveEnd();
        expect(buffer.cursorPosition).toBe(5);
    });

    it('should clear buffer', () => {
        buffer.insert('hello');
        buffer.clear();
        expect(buffer.text).toBe('');
        expect(buffer.cursorPosition).toBe(0);
    });

    it('should setText and move cursor to end', () => {
        buffer.setText('world');
        expect(buffer.text).toBe('world');
        expect(buffer.cursorPosition).toBe(5);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npx ng test cli --include='**/cli-line-buffer.spec.ts' --watch=false`
Expected: FAIL — `Cannot find module './cli-line-buffer'`

**Step 3: Write minimal implementation**

Create `projects/cli/src/lib/input/cli-line-buffer.ts`:

```typescript
/**
 * Reusable text buffer with cursor management.
 * Eliminates duplicated line-editing logic across CommandLineMode,
 * ReaderMode, and any future input mode.
 */
export class CliLineBuffer {
    private _text = '';
    private _cursorPosition = 0;

    get text(): string {
        return this._text;
    }

    get cursorPosition(): number {
        return this._cursorPosition;
    }

    set cursorPosition(value: number) {
        this._cursorPosition = Math.max(0, Math.min(value, this._text.length));
    }

    insert(str: string): void {
        this._text =
            this._text.slice(0, this._cursorPosition) +
            str +
            this._text.slice(this._cursorPosition);
        this._cursorPosition += str.length;
    }

    deleteCharBefore(): void {
        if (this._cursorPosition > 0) {
            this._text =
                this._text.slice(0, this._cursorPosition - 1) +
                this._text.slice(this._cursorPosition);
            this._cursorPosition--;
        }
    }

    deleteCharAt(): void {
        if (this._cursorPosition < this._text.length) {
            this._text =
                this._text.slice(0, this._cursorPosition) +
                this._text.slice(this._cursorPosition + 1);
        }
    }

    moveCursorLeft(): void {
        if (this._cursorPosition > 0) {
            this._cursorPosition--;
        }
    }

    moveCursorRight(): void {
        if (this._cursorPosition < this._text.length) {
            this._cursorPosition++;
        }
    }

    moveHome(): void {
        this._cursorPosition = 0;
    }

    moveEnd(): void {
        this._cursorPosition = this._text.length;
    }

    clear(): void {
        this._text = '';
        this._cursorPosition = 0;
    }

    setText(str: string): void {
        this._text = str;
        this._cursorPosition = str.length;
    }
}
```

**Step 4: Run test to verify it passes**

Run: `npx ng test cli --include='**/cli-line-buffer.spec.ts' --watch=false`
Expected: All 14 tests PASS

**Step 5: Commit**

```bash
git add projects/cli/src/lib/input/cli-line-buffer.ts projects/cli/src/lib/input/cli-line-buffer.spec.ts
git commit -m "feat(cli): add CliLineBuffer reusable text buffer with tests"
```

---

### Task 2: IInputMode Interface

**Files:**
- Create: `projects/cli/src/lib/input/input-mode.ts`

**Step 1: Create the interface**

Create `projects/cli/src/lib/input/input-mode.ts`:

```typescript
/**
 * State machine interface for terminal input routing.
 * Each mode handles its own key events and data.
 */
export interface IInputMode {
    /**
     * Handle raw terminal data (characters, escape sequences, control chars).
     * Called by terminal.onData.
     */
    handleInput(data: string): Promise<void>;

    /**
     * Handle keyboard events before they reach onData.
     * Called by terminal.attachCustomKeyEventHandler for 'keydown' events.
     * Return false to prevent the key from reaching onData.
     * Return true to let the key pass through to onData.
     */
    handleKeyEvent(event: KeyboardEvent): boolean;

    /**
     * Called when this mode becomes the active input mode.
     */
    activate?(): void;

    /**
     * Called when this mode is no longer the active input mode.
     */
    deactivate?(): void;
}
```

**Step 2: Verify build**

Run: `npm run "build cli"`
Expected: Build succeeds (unused file is fine)

**Step 3: Commit**

```bash
git add projects/cli/src/lib/input/input-mode.ts
git commit -m "feat(cli): add IInputMode interface for input routing state machine"
```

---

### Task 3: CliTerminalLineRenderer — Prompt and Line Display

**Files:**
- Create: `projects/cli/src/lib/input/cli-terminal-line-renderer.ts`

This class encapsulates all `\x1b[...]` escape sequences for command-line display. It is extracted from the following methods in `CliExecutionContext`:
- `getPromptString()` (lines 350–365)
- `refreshCurrentLine()` (lines 309–348)
- `clearLine()` (lines 271–276) — delegates to `clearTerminalLine` from core

**Step 1: Create the renderer**

Create `projects/cli/src/lib/input/cli-terminal-line-renderer.ts`:

```typescript
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
        const pathSegment = path !== null
            ? `\x1b[34m${path}\x1b[0m`
            : '\x1b[34m~\x1b[0m';
        return `${promptStart}${pathSegment}$ `;
    }

    /**
     * Writes the prompt to the terminal and returns the visible prompt length
     * (number of columns the prompt occupies).
     */
    renderPrompt(options: PromptOptions): number {
        this.terminal.write(this.getPromptString(options));
        return this.terminal.buffer.active.cursorX;
    }

    /**
     * Clears and redraws the current line (prompt + user input + cursor positioning).
     * @param currentLine The text content of the line
     * @param cursorPosition The cursor position within the text
     * @param promptLength The visible length of the prompt
     * @param promptString The full prompt string (with ANSI codes)
     * @param previousContentLength Optional total character count of the previous line content (prompt + text), used to clear wrapped lines
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
        const clearLength = previousContentLength !== undefined
            ? Math.max(contentLength, previousContentLength)
            : contentLength;
        const lines = Math.max(1, Math.ceil(clearLength / cols));

        let output = '';

        // 1. Clear lines
        for (let i = 0; i < lines; i++) {
            output += '\x1b[2K';
            if (i < lines - 1) {
                output += '\x1b[A';
            }
        }
        output += '\r';

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
     * @param contentLength Total visible character count (prompt + text)
     */
    clearLine(contentLength: number): void {
        clearTerminalLine(this.terminal, contentLength);
    }
}
```

**Step 2: Verify build**

Run: `npm run "build cli"`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add projects/cli/src/lib/input/cli-terminal-line-renderer.ts
git commit -m "feat(cli): add CliTerminalLineRenderer for prompt and line display"
```

---

### Task 4: CommandLineMode — Normal CLI Input Mode

**Files:**
- Create: `projects/cli/src/lib/input/command-line-mode.ts`

This class extracts the following logic from `CliExecutionContext`:
- `handleInput()` main branch (lines 396–455) — Enter, arrows, backspace, text, tab
- `handleTabCompletion()` (lines 473–532)
- `handleInputText()` (lines 461–471)
- `handleBackspace()` (lines 707–715)
- `moveCursorLeft()` / `moveCursorRight()` (lines 717–729)
- `showPreviousCommand()` / `showNextCommand()` / `displayCommandFromHistory()` (lines 733–759)
- Key event handler for: Ctrl+C, Escape, Ctrl+V, Ctrl+L, Shift+Arrow (lines 188–241)

It needs access to several services. We pass a `CommandLineModeHost` interface to avoid circular dependencies.

**Step 1: Create CommandLineMode**

Create `projects/cli/src/lib/input/command-line-mode.ts`:

```typescript
import { IInputMode } from './input-mode';
import { CliLineBuffer } from './cli-line-buffer';
import { CliTerminalLineRenderer, PromptOptions } from './cli-terminal-line-renderer';
import { CliCompletionEngine } from '../completion/cli-completion-engine';
import { CliCommandHistory } from '../services/cli-command-history';
import { Terminal } from '@xterm/xterm';
import { ICliCommandExecutorService, ICliExecutionContext } from '@qodalis/cli-core';

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
    abort(): void;
    showPrompt(options?: { reset?: boolean; newLine?: boolean; keepCurrentLine?: boolean }): void;
}

export class CommandLineMode implements IInputMode {
    private historyIndex = 0;
    private isExecutingCommand = false;
    private selectionStart: { x: number; y: number } | null = null;
    private selectionEnd: { x: number; y: number } | null = null;

    constructor(private readonly host: CommandLineModeHost) {}

    activate(): void {
        this.host.commandHistory.initialize().then(() => {
            this.historyIndex = this.host.commandHistory.getLastIndex();
        });
    }

    async handleInput(data: string): Promise<void> {
        if (this.host.isProgressRunning()) {
            return;
        }

        const buffer = this.host.lineBuffer;

        if (data === '\u0009') {
            await this.handleTabCompletion();
            return;
        }

        this.host.completionEngine.resetState();

        if (data === '\r') {
            this.host.terminal.write('\r\n');

            if (buffer.text) {
                await this.host.commandHistory.addCommand(buffer.text);
                this.historyIndex = this.host.commandHistory.getLastIndex();

                this.isExecutingCommand = true;
                const ctx = this.host.getExecutionContext();
                await ctx.executor.executeCommand(buffer.text, ctx);
                this.isExecutingCommand = false;

                if (ctx.onAbort.observed) {
                    this.host.terminal.write(
                        '\x1b[33mPress Ctrl+C to cancel\x1b[0m\r\n',
                    );
                }
            }

            this.host.showPrompt();
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
            if (buffer.cursorPosition < buffer.text.length) {
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
            this.host.showPrompt();
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

    // -- Private helpers --

    private handleInputText(text: string): void {
        text = text.replace(/[\r\n\t]+/g, '');

        const buffer = this.host.lineBuffer;
        buffer.insert(text);
        this.refreshLine();
    }

    private handleBackspace(): void {
        const buffer = this.host.lineBuffer;
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
                if (replacement === undefined || tokenStart === undefined || token === undefined) {
                    break;
                }

                const before = buffer.text.slice(0, tokenStart);
                const after = buffer.text.slice(tokenStart + token.length);
                const suffix = after.length === 0 && !replacement.endsWith('/') ? ' ' : '';
                buffer.setText(before + replacement + suffix + after);
                buffer.cursorPosition = tokenStart + replacement.length + suffix.length;
                this.refreshLine();
                break;
            }
            case 'show-candidates': {
                const candidates = result.candidates ?? [];
                if (candidates.length === 0) break;

                this.host.terminal.write('\r\n');

                const maxLen = Math.max(...candidates.map((c) => c.length));
                const cols = Math.max(1, Math.floor((this.host.terminal.cols || 80) / (maxLen + 2)));
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
                this.host.setPromptLength(this.host.terminal.buffer.active.cursorX);
                this.host.terminal.write(buffer.text);

                const charsAfterCursor = buffer.text.length - buffer.cursorPosition;
                if (charsAfterCursor > 0) {
                    this.host.terminal.write(`\x1b[${charsAfterCursor}D`);
                }
                break;
            }
        }
    }

    private showPreviousCommand(): void {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.displayCommandFromHistory();
        }
    }

    private showNextCommand(): void {
        const buffer = this.host.lineBuffer;

        if (this.historyIndex < this.host.commandHistory.getLastIndex() - 1) {
            this.historyIndex++;
            this.displayCommandFromHistory();
        } else {
            this.historyIndex = this.host.commandHistory.getLastIndex();
            const previousContentLength = this.host.getPromptLength() + buffer.text.length;
            buffer.clear();
            this.refreshLine(previousContentLength);
        }
    }

    private displayCommandFromHistory(): void {
        const buffer = this.host.lineBuffer;
        const previousContentLength = this.host.getPromptLength() + buffer.text.length;
        const cmd = this.host.commandHistory.getCommand(this.historyIndex) || '';
        buffer.setText(cmd);
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
    }

    private getTerminalCursorPosition(): { x: number; y: number } {
        const x: number = (this.host.terminal as any)._core.buffer.x;
        const y: number = (this.host.terminal as any)._core.buffer.y;
        return { x, y };
    }

    private updateSelection(): void {
        if (this.selectionStart && this.selectionEnd) {
            const startRow = Math.min(this.selectionStart.y, this.selectionEnd.y);
            const endRow = Math.max(this.selectionStart.y, this.selectionEnd.y);

            if (startRow === endRow) {
                const startCol = Math.min(this.selectionStart.x, this.selectionEnd.x);
                const endCol = Math.max(this.selectionStart.x, this.selectionEnd.x);
                this.host.terminal.select(startCol, startRow, Math.abs(endCol - startCol));
            } else {
                this.host.terminal.selectLines(startRow, endRow);
            }
        }
    }
}
```

**Step 2: Verify build**

Run: `npm run "build cli"`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add projects/cli/src/lib/input/command-line-mode.ts
git commit -m "feat(cli): add CommandLineMode for normal CLI input handling"
```

---

### Task 5: ReaderMode — readLine / readPassword / readConfirm / readSelect

**Files:**
- Create: `projects/cli/src/lib/input/reader-mode.ts`

This class extracts the following from `CliExecutionContext`:
- `handleReaderInput()` (lines 534–551)
- `handleLineInput()` (lines 553–591)
- `handlePasswordInput()` (lines 593–618)
- `handleConfirmInput()` (lines 621–649)
- `handleSelectInput()` (lines 652–674)
- `redrawReaderLine()` (lines 676–686)
- `redrawSelectOptions()` (lines 688–705)

It also takes over the abort handling from `attachCustomKeyEventHandler` for Ctrl+C and Escape during active input (lines 160–177).

**Step 1: Create ReaderMode**

Create `projects/cli/src/lib/input/reader-mode.ts`:

```typescript
import { Terminal } from '@xterm/xterm';
import { IInputMode } from './input-mode';
import { ActiveInputRequest } from '../services/cli-input-reader';

/**
 * Host interface for ReaderMode — provides access to the active input request.
 */
export interface ReaderModeHost {
    readonly terminal: Terminal;
    getActiveInputRequest(): ActiveInputRequest | null;
    setActiveInputRequest(request: ActiveInputRequest | null): void;
    popMode(): void;
}

/**
 * Input mode for interactive reader prompts (readLine, readPassword,
 * readConfirm, readSelect). Pushed on top of CommandLineMode when
 * a reader request starts, pops itself when the request completes.
 */
export class ReaderMode implements IInputMode {
    constructor(private readonly host: ReaderModeHost) {}

    async handleInput(data: string): Promise<void> {
        const request = this.host.getActiveInputRequest();
        if (!request) {
            return;
        }

        switch (request.type) {
            case 'line':
                this.handleLineInput(request, data);
                break;
            case 'password':
                this.handlePasswordInput(request, data);
                break;
            case 'confirm':
                this.handleConfirmInput(request, data);
                break;
            case 'select':
                this.handleSelectInput(request, data);
                break;
        }
    }

    handleKeyEvent(event: KeyboardEvent): boolean {
        if (event.code === 'KeyC' && event.ctrlKey) {
            const request = this.host.getActiveInputRequest();
            if (request) {
                request.resolve(null);
                this.host.setActiveInputRequest(null);
                this.host.terminal.writeln('');
                this.host.popMode();
            }
            return false;
        }

        if (event.code === 'Escape') {
            const request = this.host.getActiveInputRequest();
            if (request) {
                request.resolve(null);
                this.host.setActiveInputRequest(null);
                this.host.terminal.writeln('');
                this.host.popMode();
            }
            return false;
        }

        return true;
    }

    private handleLineInput(request: ActiveInputRequest, data: string): void {
        if (data === '\r') {
            this.host.terminal.write('\r\n');
            const value = request.buffer;
            this.host.setActiveInputRequest(null);
            this.host.popMode();
            request.resolve(value);
        } else if (data === '\u007F') {
            if (request.cursorPosition > 0) {
                request.buffer =
                    request.buffer.slice(0, request.cursorPosition - 1) +
                    request.buffer.slice(request.cursorPosition);
                request.cursorPosition--;
                this.redrawReaderLine(request, request.buffer);
            }
        } else if (data === '\u001B[D') {
            if (request.cursorPosition > 0) {
                request.cursorPosition--;
                this.host.terminal.write(data);
            }
        } else if (data === '\u001B[C') {
            if (request.cursorPosition < request.buffer.length) {
                request.cursorPosition++;
                this.host.terminal.write(data);
            }
        } else if (data.startsWith('\u001B')) {
            // Ignore other escape sequences
        } else {
            const text = data.replace(/[\r\n]+/g, '');
            request.buffer =
                request.buffer.slice(0, request.cursorPosition) +
                text +
                request.buffer.slice(request.cursorPosition);
            request.cursorPosition += text.length;
            this.redrawReaderLine(request, request.buffer);
        }
    }

    private handlePasswordInput(request: ActiveInputRequest, data: string): void {
        if (data === '\r') {
            this.host.terminal.write('\r\n');
            const value = request.buffer;
            this.host.setActiveInputRequest(null);
            this.host.popMode();
            request.resolve(value);
        } else if (data === '\u007F') {
            if (request.cursorPosition > 0) {
                request.buffer =
                    request.buffer.slice(0, request.cursorPosition - 1) +
                    request.buffer.slice(request.cursorPosition);
                request.cursorPosition--;
                this.redrawReaderLine(request, '*'.repeat(request.buffer.length));
            }
        } else if (data.startsWith('\u001B')) {
            // Ignore all escape sequences for password
        } else {
            const text = data.replace(/[\r\n]+/g, '');
            request.buffer =
                request.buffer.slice(0, request.cursorPosition) +
                text +
                request.buffer.slice(request.cursorPosition);
            request.cursorPosition += text.length;
            this.redrawReaderLine(request, '*'.repeat(request.buffer.length));
        }
    }

    private handleConfirmInput(request: ActiveInputRequest, data: string): void {
        if (data === '\r') {
            this.host.terminal.write('\r\n');
            this.host.setActiveInputRequest(null);
            this.host.popMode();
            const buf = request.buffer.toLowerCase();
            if (buf === 'y') {
                request.resolve(true);
            } else if (buf === 'n') {
                request.resolve(false);
            } else {
                request.resolve(request.defaultValue ?? false);
            }
        } else if (data === '\u007F') {
            if (request.cursorPosition > 0) {
                request.buffer = request.buffer.slice(0, -1);
                request.cursorPosition--;
                this.redrawReaderLine(request, request.buffer);
            }
        } else if (data.startsWith('\u001B')) {
            // Ignore escape sequences
        } else {
            const char = data.toLowerCase();
            if (char === 'y' || char === 'n') {
                request.buffer = data;
                request.cursorPosition = 1;
                this.redrawReaderLine(request, request.buffer);
            }
        }
    }

    private handleSelectInput(request: ActiveInputRequest, data: string): void {
        const options = request.options!;
        const selectedIndex = request.selectedIndex!;

        if (data === '\r') {
            this.host.terminal.write('\r\n');
            this.host.setActiveInputRequest(null);
            this.host.popMode();
            request.resolve(options[selectedIndex].value);
        } else if (data === '\u001B[A') {
            if (selectedIndex > 0) {
                request.selectedIndex = selectedIndex - 1;
                this.redrawSelectOptions(request);
            }
        } else if (data === '\u001B[B') {
            if (selectedIndex < options.length - 1) {
                request.selectedIndex = selectedIndex + 1;
                this.redrawSelectOptions(request);
            }
        }
    }

    private redrawReaderLine(request: ActiveInputRequest, displayText: string): void {
        this.host.terminal.write('\x1b[2K\r');
        this.host.terminal.write(request.promptText + displayText);

        const cursorOffset = request.buffer.length - request.cursorPosition;
        if (cursorOffset > 0) {
            this.host.terminal.write(`\x1b[${cursorOffset}D`);
        }
    }

    private redrawSelectOptions(request: ActiveInputRequest): void {
        const options = request.options!;
        const selectedIndex = request.selectedIndex!;

        if (options.length > 0) {
            this.host.terminal.write(`\x1b[${options.length}A`);
        }

        for (let i = 0; i < options.length; i++) {
            this.host.terminal.write('\x1b[2K\r');
            const prefix = i === selectedIndex ? '  \x1b[36m> ' : '    ';
            const suffix = i === selectedIndex ? '\x1b[0m' : '';
            this.host.terminal.write(`${prefix}${options[i].label}${suffix}\r\n`);
        }
    }
}
```

**Step 2: Verify build**

Run: `npm run "build cli"`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add projects/cli/src/lib/input/reader-mode.ts
git commit -m "feat(cli): add ReaderMode for interactive input prompts"
```

---

### Task 6: RawMode — Full-Screen Processor Input

**Files:**
- Create: `projects/cli/src/lib/input/raw-mode.ts`

This class wraps a context processor's `onData` method. It replaces the `if (this.contextProcessor?.onData)` branches in `CliExecutionContext`:
- In `handleInput()` (lines 408–411)
- In `attachCustomKeyEventHandler` (lines 180–186)

**Step 1: Create RawMode**

Create `projects/cli/src/lib/input/raw-mode.ts`:

```typescript
import { IInputMode } from './input-mode';
import { ICliCommandProcessor, ICliExecutionContext } from '@qodalis/cli-core';

/**
 * Input mode for full-screen command processors (nano editor, pager, etc.).
 * Bypasses all default key handling — routes everything to the processor's onData.
 */
export class RawMode implements IInputMode {
    constructor(
        private readonly processor: ICliCommandProcessor,
        private readonly context: ICliExecutionContext,
    ) {}

    async handleInput(data: string): Promise<void> {
        if (this.processor.onData) {
            await this.processor.onData(data, this.context);
        }
    }

    handleKeyEvent(event: KeyboardEvent): boolean {
        // Prevent browser defaults for Ctrl key combos (Ctrl+S, Ctrl+Q, etc.)
        if (event.ctrlKey) {
            event.preventDefault();
        }
        // Let all keys pass through to onData
        return true;
    }
}
```

**Step 2: Verify build**

Run: `npm run "build cli"`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add projects/cli/src/lib/input/raw-mode.ts
git commit -m "feat(cli): add RawMode for full-screen processor input"
```

---

### Task 7: Barrel Export for Input Module

**Files:**
- Create: `projects/cli/src/lib/input/index.ts`

**Step 1: Create barrel**

Create `projects/cli/src/lib/input/index.ts`:

```typescript
export { CliLineBuffer } from './cli-line-buffer';
export { IInputMode } from './input-mode';
export { CommandLineMode, CommandLineModeHost } from './command-line-mode';
export { ReaderMode, ReaderModeHost } from './reader-mode';
export { RawMode } from './raw-mode';
export { CliTerminalLineRenderer, PromptOptions } from './cli-terminal-line-renderer';
```

**Step 2: Verify build**

Run: `npm run "build cli"`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add projects/cli/src/lib/input/index.ts
git commit -m "feat(cli): add barrel export for input module"
```

---

### Task 8: Refactor CliExecutionContext — Wire Up Components

This is the big integration task. We modify `CliExecutionContext` to:
1. Create and hold the new components (`CliLineBuffer`, `CliTerminalLineRenderer`, mode instances)
2. Implement `CommandLineModeHost` and `ReaderModeHost` interfaces
3. Use a mode stack (`IInputMode[]`) with `pushMode` / `popMode`
4. Delegate `initializeTerminalListeners` to the mode stack
5. Update `setContextProcessor` to push/pop `RawMode`
6. Update `setActiveInputRequest` to push/pop `ReaderMode`
7. Keep all public API signatures identical — `showPrompt`, `clearLine`, `refreshCurrentLine`, `setCurrentLine`, `currentLine`, `cursorPosition`, `promptLength` all remain
8. Remove the old duplicated methods

**Files:**
- Modify: `projects/cli/src/lib/context/cli-execution-context.ts`

**Step 1: Rewrite CliExecutionContext**

Replace the contents of `projects/cli/src/lib/context/cli-execution-context.ts` with:

```typescript
import { Terminal } from '@xterm/xterm';
import { Subject } from 'rxjs';
import {
    ICliExecutionContext,
    ICliTerminalWriter,
    ICliUserSession,
    CliOptions,
    ICliSpinner,
    ICliPercentageProgressBar,
    ICliClipboard,
    ICliExecutionProcess,
    ICliCommandProcessor,
    ICliLogger,
    CliLogLevel,
    ICliServiceProvider,
    ICliStateStore,
    ICliTextAnimator,
    ICliCommandExecutorService,
    ICliInputReader,
} from '@qodalis/cli-core';
import { CliTerminalWriter } from '../services/cli-terminal-writer';
import { CliTerminalSpinner } from '../services/progress-bars/cli-terminal-spinner';
import { CliTerminalProgressBar } from '../services/progress-bars/cli-terminal-progress-bar';
import { CliTerminalTextAnimator } from '../services/progress-bars/cli-terminal-text-animator';
import { CliClipboard } from '../services/cli-clipboard';
import { CliCommandHistory } from '../services/cli-command-history';
import { CliExecutionProcess } from './cli-execution-process';
import { CliStateStoreManager } from '../state/cli-state-store-manager';
import { CliInputReader, ActiveInputRequest, CliInputReaderHost } from '../services/cli-input-reader';
import { CliCompletionEngine } from '../completion/cli-completion-engine';

import { CliLineBuffer } from '../input/cli-line-buffer';
import { CliTerminalLineRenderer, PromptOptions } from '../input/cli-terminal-line-renderer';
import { IInputMode } from '../input/input-mode';
import { CommandLineMode, CommandLineModeHost } from '../input/command-line-mode';
import { ReaderMode, ReaderModeHost } from '../input/reader-mode';
import { RawMode } from '../input/raw-mode';

export interface CliExecutionContextDeps {
    services: ICliServiceProvider;
    logger: ICliLogger;
    commandHistory: CliCommandHistory;
    stateStoreManager: CliStateStoreManager;
}

export class CliExecutionContext
    implements ICliExecutionContext, CliInputReaderHost, CommandLineModeHost, ReaderModeHost
{
    public userSession?: ICliUserSession;

    public contextProcessor?: ICliCommandProcessor;

    public readonly writer: ICliTerminalWriter;

    public readonly spinner: ICliSpinner;

    public readonly textAnimator: ICliTextAnimator;

    public readonly progressBar: ICliPercentageProgressBar;

    public readonly options?: CliOptions;

    public readonly onAbort = new Subject<void>();

    public readonly state: ICliStateStore;

    public readonly clipboard: ICliClipboard;

    public readonly process: ICliExecutionProcess;

    public readonly logger: ICliLogger;

    public readonly services: ICliServiceProvider;

    public promptPathProvider?: () => string | null;

    public readonly completionEngine = new CliCompletionEngine();

    public promptLength: number = 0;

    public readonly reader: ICliInputReader;

    public readonly lineBuffer = new CliLineBuffer();

    public readonly lineRenderer: CliTerminalLineRenderer;

    public readonly commandHistory: CliCommandHistory;

    private _activeInputRequest: ActiveInputRequest | null = null;

    private modeStack: IInputMode[] = [];
    private commandLineMode!: CommandLineMode;
    private readerMode!: ReaderMode;

    public get activeInputRequest(): ActiveInputRequest | null {
        return this._activeInputRequest;
    }

    public setActiveInputRequest(request: ActiveInputRequest | null): void {
        this._activeInputRequest = request;
        if (request) {
            this.pushMode(this.readerMode);
        }
    }

    public writeToTerminal(text: string): void {
        this.terminal.write(text);
    }

    public get currentLine(): string {
        return this.lineBuffer.text;
    }

    public get cursorPosition(): number {
        return this.lineBuffer.cursorPosition;
    }

    public set cursorPosition(value: number) {
        this.lineBuffer.cursorPosition = value;
    }

    constructor(
        deps: CliExecutionContextDeps,
        public terminal: Terminal,
        public executor: ICliCommandExecutorService,
        cliOptions?: CliOptions,
    ) {
        this.services = deps.services;

        const stateStoreManager = deps.stateStoreManager;
        this.state = stateStoreManager.getStateStore('shared');

        this.options = cliOptions;
        this.writer = new CliTerminalWriter(terminal);

        const spinner = new CliTerminalSpinner(terminal);
        const progressBar = new CliTerminalProgressBar(terminal);
        const textAnimator = new CliTerminalTextAnimator(terminal);

        spinner.context = this;
        progressBar.context = this;
        textAnimator.context = this;

        this.spinner = spinner;
        this.progressBar = progressBar;
        this.textAnimator = textAnimator;

        this.clipboard = new CliClipboard(this);
        this.process = new CliExecutionProcess(this);

        this.reader = new CliInputReader(this);

        this.logger = deps.logger;
        this.logger.setCliLogLevel(cliOptions?.logLevel || CliLogLevel.ERROR);

        this.commandHistory = deps.commandHistory;
        this.lineRenderer = new CliTerminalLineRenderer(terminal, this.writer);

        // Initialize modes
        this.commandLineMode = new CommandLineMode(this);
        this.readerMode = new ReaderMode(this);
        this.modeStack = [this.commandLineMode];
    }

    // -- CommandLineModeHost implementation --

    getPromptOptions(): PromptOptions {
        return {
            userName: this.userSession?.displayName,
            hideUserName: this.options?.usersModule?.hideUserName,
            contextProcessor: this.contextProcessor?.command,
            pathProvider: this.promptPathProvider,
        };
    }

    getPromptLength(): number {
        return this.promptLength;
    }

    setPromptLength(value: number): void {
        this.promptLength = value;
    }

    getExecutionContext(): ICliExecutionContext {
        return this;
    }

    // -- ReaderModeHost implementation --

    getActiveInputRequest(): ActiveInputRequest | null {
        return this._activeInputRequest;
    }

    // -- Mode stack --

    private get currentMode(): IInputMode {
        return this.modeStack[this.modeStack.length - 1];
    }

    pushMode(mode: IInputMode): void {
        this.currentMode.deactivate?.();
        this.modeStack.push(mode);
        mode.activate?.();
    }

    popMode(): void {
        if (this.modeStack.length > 1) {
            const popped = this.modeStack.pop()!;
            popped.deactivate?.();
            this.currentMode.activate?.();
        }
    }

    // -- Terminal listeners --

    initializeTerminalListeners(): void {
        this.commandLineMode.activate?.();

        this.terminal.onData(async (data) => {
            if (this.isProgressRunning()) {
                return;
            }
            await this.currentMode.handleInput(data);
        });

        this.terminal.onKey(async (_event) => {});

        this.terminal.attachCustomKeyEventHandler((event) => {
            if (event.type === 'keydown') {
                return this.currentMode.handleKeyEvent(event);
            }
            return true;
        });
    }

    // -- Context processor --

    setContextProcessor(
        processor: ICliCommandProcessor | undefined,
        silent?: boolean,
    ): void {
        // Pop existing RawMode if we had one
        if (this.contextProcessor?.onData && this.modeStack.length > 1) {
            // Pop all non-base modes (RawMode could be stacked)
            while (this.modeStack.length > 1 && this.modeStack[this.modeStack.length - 1] instanceof RawMode) {
                this.popMode();
            }
        }

        if (!processor) {
            this.contextProcessor = processor;
            return;
        }

        if (!silent) {
            this.writer.writeInfo(
                'Set ' +
                    processor?.command +
                    ' as context processor, press Ctrl+C to exit',
            );
        }

        this.contextProcessor = processor;

        // If processor has onData, push RawMode
        if (processor.onData) {
            this.pushMode(new RawMode(processor, this));
        }
    }

    // -- Public API (unchanged signatures) --

    setCurrentLine(line: string): void {
        this.lineBuffer.setText(line);
    }

    clearLine(): void {
        this.lineRenderer.clearLine(
            this.promptLength + this.lineBuffer.text.length,
        );
    }

    showPrompt(options?: {
        reset?: boolean;
        newLine?: boolean;
        keepCurrentLine?: boolean;
    }): void {
        const { reset, newLine, keepCurrentLine } = options || {};

        if (reset) {
            this.terminal.write('\x1b[2K\r');
        }

        if (newLine) {
            this.terminal.write('\r\n');
        }

        if (!keepCurrentLine) {
            this.lineBuffer.clear();
        }

        this.promptLength = this.lineRenderer.renderPrompt(
            this.getPromptOptions(),
        );
    }

    clearCurrentLine(): void {
        this.clearLine();
        this.showPrompt();
    }

    refreshCurrentLine(previousContentLength?: number): void {
        const promptStr = this.lineRenderer.getPromptString(
            this.getPromptOptions(),
        );
        this.lineRenderer.refreshLine(
            this.lineBuffer.text,
            this.lineBuffer.cursorPosition,
            this.promptLength,
            promptStr,
            previousContentLength,
        );
    }

    // -- Progress & abort --

    public isProgressRunning(): boolean {
        return (
            this.progressBar.isRunning ||
            this.spinner.isRunning ||
            this.textAnimator.isRunning
        );
    }

    public abort(): void {
        if (this.progressBar.isRunning) {
            this.progressBar.complete();
        }

        if (this.spinner?.isRunning) {
            this.spinner.hide();
        }

        if (this.textAnimator?.isRunning) {
            this.textAnimator.hide();
        }

        this.onAbort.next();
    }

    public setSession(session: ICliUserSession): void {
        this.userSession = session;
    }
}
```

**Step 2: Verify build**

Run: `npm run "build cli"`
Expected: Build succeeds. If there are import issues, fix them.

**Step 3: Build the full project**

Run: `npm run "build all"`
Expected: All libraries build successfully.

**Step 4: Commit**

```bash
git add projects/cli/src/lib/context/cli-execution-context.ts
git commit -m "refactor(cli): rewrite CliExecutionContext to delegate to input components

Replaces inline input handling with mode stack (CommandLineMode, ReaderMode, RawMode).
Uses CliLineBuffer for text editing and CliTerminalLineRenderer for display.
Public ICliExecutionContext interface remains unchanged."
```

---

### Task 9: Update CliCommandExecutionContext for CliLineBuffer Compatibility

The `CliCommandExecutionContext` proxy class delegates `currentLine`, `cursorPosition`, and `setCurrentLine` to the parent context. With `CliLineBuffer` now backing these, verify the proxy still works correctly.

**Files:**
- Modify: `projects/cli/src/lib/context/cli-command-execution-context.ts`

**Step 1: Review and update if needed**

Read `projects/cli/src/lib/context/cli-command-execution-context.ts`. The getters/setters for `currentLine`, `cursorPosition`, and `setCurrentLine` delegate to `context.*` which still exists on the public interface. No code change should be needed — just verify.

**Step 2: Verify build**

Run: `npm run "build all"`
Expected: All libraries build successfully, no type errors.

**Step 3: Commit (only if changes were needed)**

```bash
# Only if modifications were necessary:
git add projects/cli/src/lib/context/cli-command-execution-context.ts
git commit -m "fix(cli): update CliCommandExecutionContext for line buffer compatibility"
```

---

### Task 10: Full Build Verification and Manual Testing

**Files:** None (verification only)

**Step 1: Clean build**

Run: `npm run "build all"`
Expected: All 14 libraries build successfully, zero errors.

**Step 2: Run tests**

Run: `npm test`
Expected: All tests pass (including the new `CliLineBuffer` tests).

**Step 3: Manual testing checklist**

Start the demo app:

Run: `npm run "start demo"`

Test in browser at `http://localhost:4300`:

1. **Normal command input**: Type `help`, press Enter. Verify output displays correctly and prompt reappears.
2. **Command history**: Type `echo hello`, Enter. Press Up arrow — verify `echo hello` appears. Press Down arrow — verify line clears.
3. **Cursor movement**: Type `hello world`, press Left arrow 5 times, type `big ` — verify result is `hello big world`.
4. **Backspace**: Type `helloo`, press Backspace — verify `hello`.
5. **Tab completion**: Type `he` and press Tab — verify completion or candidate display.
6. **Ctrl+C**: While idle, press Ctrl+C — verify `Ctrl+C` printed and new prompt appears.
7. **Ctrl+L**: Press Ctrl+L — verify terminal clears and prompt reappears.
8. **readLine**: Run a command that uses `reader.readLine()` (if available) — verify typing works and Enter resolves.
9. **readSelect**: Run a command that uses `reader.readSelect()` — verify arrow key navigation works and Enter selects.
10. **nano editor**: Type `nano` and press Enter — verify alternate screen opens, typing works, Ctrl+Q exits cleanly.
11. **nano with file**: Type `nano test.txt`, type some text, Ctrl+S to save, Ctrl+Q to quit. Then `cat test.txt` to verify.

**Step 4: Commit any fixes from manual testing**

```bash
git add -A
git commit -m "fix(cli): address issues found during manual testing"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | CliLineBuffer + tests | `input/cli-line-buffer.ts`, `.spec.ts` |
| 2 | IInputMode interface | `input/input-mode.ts` |
| 3 | CliTerminalLineRenderer | `input/cli-terminal-line-renderer.ts` |
| 4 | CommandLineMode | `input/command-line-mode.ts` |
| 5 | ReaderMode | `input/reader-mode.ts` |
| 6 | RawMode | `input/raw-mode.ts` |
| 7 | Barrel export | `input/index.ts` |
| 8 | Rewrite CliExecutionContext | `context/cli-execution-context.ts` |
| 9 | Verify CliCommandExecutionContext | `context/cli-command-execution-context.ts` |
| 10 | Full build + manual testing | — |

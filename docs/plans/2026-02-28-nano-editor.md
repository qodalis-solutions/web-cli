# Nano-Style Terminal Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a built-in `nano` command that provides a full-screen nano-style text editor in xterm.js, with optional file I/O via the virtual filesystem plugin.

**Architecture:** The editor uses a new `onData` raw-input hook on `ICliCommandProcessor` so context processors can intercept all terminal input. The nano processor enters xterm.js alternate screen buffer, renders title/content/status bars via escape codes, and handles all keypresses. File operations use `IFileSystemService` when the files plugin is loaded.

**Tech Stack:** TypeScript, xterm.js escape codes, ICliCommandProcessor pattern

---

### Task 1: Add `onData` Raw Input Hook to Core

The editor needs to intercept ALL terminal input (arrows, Enter, Ctrl+keys) — not just command strings. Add an optional `onData` method to `ICliCommandProcessor` that context processors can implement to receive raw terminal data.

**Files:**
- Modify: `projects/core/src/lib/interfaces/command-processor.ts`

**Step 1: Add `onData` to ICliCommandProcessor**

In `projects/core/src/lib/interfaces/command-processor.ts`, add this method to the `ICliCommandProcessor` interface, after the `initialize?` method (line 177):

```typescript
    /**
     * Handle raw terminal data when this processor is the active context processor.
     * When implemented, ALL terminal input is routed here instead of normal CLI input handling.
     * Used for full-screen interactive modes (editors, pagers, etc.).
     * @param data The raw terminal data string (escape sequences, control chars, printable text)
     * @param context The execution context
     */
    onData?(data: string, context: ICliExecutionContext): Promise<void>;
```

**Step 2: Build core to verify**

```bash
npx ng build core
```

Expected: Build succeeds. This is an optional method so no existing processors break.

**Step 3: Commit**

```bash
git add projects/core/src/lib/interfaces/command-processor.ts
git commit -m "feat(core): add onData raw input hook to ICliCommandProcessor"
```

---

### Task 2: Route Raw Input to Context Processor in CLI

Modify `CliExecutionContext` so that when the active context processor has `onData`, all terminal input is routed there instead of normal command-line handling. Also modify the key event handler to bypass default Ctrl+C/Escape behavior and prevent browser interception of Ctrl+S/Q/K.

**Files:**
- Modify: `projects/cli/src/lib/context/cli-execution-context.ts`

**Step 1: Modify `handleInput` to check for `onData`**

In the `handleInput` method (line 388), add this check right after the `_activeInputRequest` check (after line 396), before the tab key check:

```typescript
        // If context processor handles raw input, delegate everything to it
        if (this.contextProcessor?.onData) {
            await this.contextProcessor.onData(data, this);
            return;
        }
```

**Step 2: Modify `attachCustomKeyEventHandler` to bypass defaults in raw-input mode**

In `initializeTerminalListeners` (line 157), inside the `attachCustomKeyEventHandler` callback, add this check right after the `_activeInputRequest` block (after line 177), before the Ctrl+C handler:

```typescript
                // If context processor handles raw input, bypass default key handling
                if (this.contextProcessor?.onData) {
                    // Prevent browser defaults for editor shortcuts
                    if (event.ctrlKey) {
                        event.preventDefault();
                    }
                    return true; // Let all keys pass through to onData
                }
```

**Step 3: Build cli to verify**

```bash
npx ng build core && npx ng build cli
```

Expected: Build succeeds. No behavioral change for existing commands (none implement `onData`).

**Step 4: Commit**

```bash
git add projects/cli/src/lib/context/cli-execution-context.ts
git commit -m "feat(cli): route raw input to context processor onData hook"
```

---

### Task 3: Create NanoEditorBuffer

The text buffer model that manages lines, cursor position, scroll offset, and text manipulation operations.

**Files:**
- Create: `projects/cli/src/lib/editor/nano-editor-buffer.ts`

**Step 1: Create the buffer class**

Create `projects/cli/src/lib/editor/nano-editor-buffer.ts`:

```typescript
/**
 * Text buffer for the nano-style editor.
 * Manages lines of text, cursor position, scroll offset, and edit operations.
 */
export class NanoEditorBuffer {
    lines: string[] = [''];
    cursorRow = 0;
    cursorCol = 0;
    scrollOffset = 0;
    dirty = false;

    /** Load content into the buffer, replacing existing content. */
    load(content: string): void {
        this.lines = content.split('\n');
        if (this.lines.length === 0) {
            this.lines = [''];
        }
        this.cursorRow = 0;
        this.cursorCol = 0;
        this.scrollOffset = 0;
        this.dirty = false;
    }

    /** Get the full buffer content as a single string. */
    getContent(): string {
        return this.lines.join('\n');
    }

    /** Insert a character at the current cursor position. */
    insertChar(ch: string): void {
        const line = this.lines[this.cursorRow];
        this.lines[this.cursorRow] =
            line.slice(0, this.cursorCol) + ch + line.slice(this.cursorCol);
        this.cursorCol += ch.length;
        this.dirty = true;
    }

    /** Insert a newline, splitting the current line at the cursor. */
    insertNewline(): void {
        const line = this.lines[this.cursorRow];
        const before = line.slice(0, this.cursorCol);
        const after = line.slice(this.cursorCol);
        this.lines[this.cursorRow] = before;
        this.lines.splice(this.cursorRow + 1, 0, after);
        this.cursorRow++;
        this.cursorCol = 0;
        this.dirty = true;
    }

    /** Delete the character before the cursor (backspace). */
    deleteCharBefore(): void {
        if (this.cursorCol > 0) {
            const line = this.lines[this.cursorRow];
            this.lines[this.cursorRow] =
                line.slice(0, this.cursorCol - 1) + line.slice(this.cursorCol);
            this.cursorCol--;
            this.dirty = true;
        } else if (this.cursorRow > 0) {
            // Merge with previous line
            const prevLine = this.lines[this.cursorRow - 1];
            const curLine = this.lines[this.cursorRow];
            this.cursorCol = prevLine.length;
            this.lines[this.cursorRow - 1] = prevLine + curLine;
            this.lines.splice(this.cursorRow, 1);
            this.cursorRow--;
            this.dirty = true;
        }
    }

    /** Delete the character at the cursor (delete key). */
    deleteCharAt(): void {
        const line = this.lines[this.cursorRow];
        if (this.cursorCol < line.length) {
            this.lines[this.cursorRow] =
                line.slice(0, this.cursorCol) + line.slice(this.cursorCol + 1);
            this.dirty = true;
        } else if (this.cursorRow < this.lines.length - 1) {
            // Merge with next line
            this.lines[this.cursorRow] = line + this.lines[this.cursorRow + 1];
            this.lines.splice(this.cursorRow + 1, 1);
            this.dirty = true;
        }
    }

    /** Delete the entire current line (Ctrl+K). */
    deleteLine(): void {
        if (this.lines.length === 1) {
            this.lines[0] = '';
            this.cursorCol = 0;
        } else {
            this.lines.splice(this.cursorRow, 1);
            if (this.cursorRow >= this.lines.length) {
                this.cursorRow = this.lines.length - 1;
            }
            this.cursorCol = Math.min(
                this.cursorCol,
                this.lines[this.cursorRow].length,
            );
        }
        this.dirty = true;
    }

    /** Move cursor up one line. */
    moveUp(): void {
        if (this.cursorRow > 0) {
            this.cursorRow--;
            this.cursorCol = Math.min(
                this.cursorCol,
                this.lines[this.cursorRow].length,
            );
        }
    }

    /** Move cursor down one line. */
    moveDown(): void {
        if (this.cursorRow < this.lines.length - 1) {
            this.cursorRow++;
            this.cursorCol = Math.min(
                this.cursorCol,
                this.lines[this.cursorRow].length,
            );
        }
    }

    /** Move cursor left one character. */
    moveLeft(): void {
        if (this.cursorCol > 0) {
            this.cursorCol--;
        } else if (this.cursorRow > 0) {
            this.cursorRow--;
            this.cursorCol = this.lines[this.cursorRow].length;
        }
    }

    /** Move cursor right one character. */
    moveRight(): void {
        if (this.cursorCol < this.lines[this.cursorRow].length) {
            this.cursorCol++;
        } else if (this.cursorRow < this.lines.length - 1) {
            this.cursorRow++;
            this.cursorCol = 0;
        }
    }

    /** Move cursor to the start of the current line. */
    moveHome(): void {
        this.cursorCol = 0;
    }

    /** Move cursor to the end of the current line. */
    moveEnd(): void {
        this.cursorCol = this.lines[this.cursorRow].length;
    }

    /**
     * Ensure the cursor row is visible within the viewport.
     * @param viewportHeight Number of visible content rows
     */
    ensureVisible(viewportHeight: number): void {
        if (this.cursorRow < this.scrollOffset) {
            this.scrollOffset = this.cursorRow;
        } else if (this.cursorRow >= this.scrollOffset + viewportHeight) {
            this.scrollOffset = this.cursorRow - viewportHeight + 1;
        }
    }
}
```

**Step 2: Build to verify**

```bash
npx ng build cli
```

Expected: Build succeeds (file is not imported yet, but no syntax errors).

**Step 3: Commit**

```bash
git add projects/cli/src/lib/editor/nano-editor-buffer.ts
git commit -m "feat(cli): add NanoEditorBuffer text buffer model"
```

---

### Task 4: Create NanoEditorRenderer

Renders the editor UI to the xterm.js terminal using escape codes. Manages alternate screen buffer, title bar, content area, and status bar.

**Files:**
- Create: `projects/cli/src/lib/editor/nano-editor-renderer.ts`

**Step 1: Create the renderer class**

Create `projects/cli/src/lib/editor/nano-editor-renderer.ts`:

```typescript
import { Terminal } from '@xterm/xterm';
import { NanoEditorBuffer } from './nano-editor-buffer';

/**
 * Renders the nano-style editor UI to an xterm.js terminal.
 * Uses alternate screen buffer to preserve scroll history.
 */
export class NanoEditorRenderer {
    constructor(
        private readonly terminal: Terminal,
    ) {}

    /** Enter alternate screen buffer and hide default cursor. */
    enterAlternateScreen(): void {
        this.terminal.write('\x1b[?1049h'); // Enter alternate screen
        this.terminal.write('\x1b[?25l');   // Hide cursor
    }

    /** Leave alternate screen buffer and restore cursor. */
    leaveAlternateScreen(): void {
        this.terminal.write('\x1b[?25h');   // Show cursor
        this.terminal.write('\x1b[?1049l'); // Leave alternate screen
    }

    /** Get the number of content rows available (total rows minus title and status bars). */
    get contentHeight(): number {
        return this.terminal.rows - 2;
    }

    /** Full redraw of the editor screen. */
    render(buffer: NanoEditorBuffer, fileName: string, statusMessage?: string): void {
        const { rows, cols } = this.terminal;

        buffer.ensureVisible(this.contentHeight);

        let output = '\x1b[?25l'; // Hide cursor during redraw

        // Title bar (row 1)
        output += '\x1b[H'; // Move to top-left
        output += this.renderTitleBar(fileName, buffer.dirty, cols);

        // Content area (rows 2 to rows-1)
        for (let i = 0; i < this.contentHeight; i++) {
            const lineIdx = buffer.scrollOffset + i;
            output += `\x1b[${i + 2};1H`; // Move to row i+2, col 1
            output += '\x1b[2K'; // Clear line

            if (lineIdx < buffer.lines.length) {
                const line = buffer.lines[lineIdx];
                // Truncate to terminal width
                output += line.length > cols ? line.slice(0, cols) : line;
            }
        }

        // Status bar (last row)
        output += `\x1b[${rows};1H`;
        output += this.renderStatusBar(statusMessage, cols);

        // Position cursor
        const screenRow = buffer.cursorRow - buffer.scrollOffset + 2;
        const screenCol = buffer.cursorCol + 1;
        output += `\x1b[${screenRow};${screenCol}H`;
        output += '\x1b[?25h'; // Show cursor

        this.terminal.write(output);
    }

    /** Render just the status bar (for transient messages). */
    renderStatusOnly(buffer: NanoEditorBuffer, statusMessage: string): void {
        const { rows, cols } = this.terminal;

        let output = `\x1b[${rows};1H`;
        output += this.renderStatusBar(statusMessage, cols);

        // Restore cursor position
        const screenRow = buffer.cursorRow - buffer.scrollOffset + 2;
        const screenCol = buffer.cursorCol + 1;
        output += `\x1b[${screenRow};${screenCol}H`;

        this.terminal.write(output);
    }

    private renderTitleBar(fileName: string, dirty: boolean, cols: number): string {
        const title = `  CLI Nano  ${fileName || 'New Buffer'}${dirty ? ' (modified)' : ''}`;
        const padded = title.padEnd(cols);
        return `\x1b[7m${padded}\x1b[0m`; // Inverted colors
    }

    private renderStatusBar(statusMessage: string | undefined, cols: number): string {
        const text = statusMessage || '  ^S Save  ^Q Quit  ^K Cut Line';
        const padded = text.padEnd(cols);
        return `\x1b[7m${padded}\x1b[0m`; // Inverted colors
    }
}
```

**Step 2: Build to verify**

```bash
npx ng build cli
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add projects/cli/src/lib/editor/nano-editor-renderer.ts
git commit -m "feat(cli): add NanoEditorRenderer for terminal UI rendering"
```

---

### Task 5: Create CliNanoCommandProcessor

The main command processor that wires together the buffer, renderer, and input handling. Implements `onData` for raw input interception.

**Files:**
- Create: `projects/cli/src/lib/processors/system/cli-nano-command-processor.ts`

**Step 1: Create the processor**

Create `projects/cli/src/lib/processors/system/cli-nano-command-processor.ts`:

```typescript
import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    DefaultLibraryAuthor,
} from '@qodalis/cli-core';
import { NanoEditorBuffer } from '../../editor/nano-editor-buffer';
import { NanoEditorRenderer } from '../../editor/nano-editor-renderer';

/** Token string for IFileSystemService — avoid hard dependency on files plugin. */
const FS_TOKEN = 'cli-file-system-service';

/** Minimal interface for file operations (matches IFileSystemService). */
interface FileSystemLike {
    readFile(path: string): string | null;
    writeFile(path: string, content: string, append?: boolean): void;
    createFile(path: string, content?: string): void;
    exists(path: string): boolean;
    isDirectory(path: string): boolean;
    resolvePath(path: string): string;
    persist(): Promise<void>;
}

export class CliNanoCommandProcessor implements ICliCommandProcessor {
    command = 'nano';
    aliases = ['edit'];
    description = 'Open the built-in text editor';
    author = DefaultLibraryAuthor;
    allowUnlistedCommands = true;
    metadata: CliProcessorMetadata = {
        icon: '📝',
        module: 'system',
    };

    private buffer!: NanoEditorBuffer;
    private renderer!: NanoEditorRenderer;
    private filePath: string | null = null;
    private fs: FileSystemLike | null = null;
    private context!: ICliExecutionContext;
    private resizeDisposable: { dispose(): void } | null = null;
    private statusMessage: string | undefined;
    private statusTimeout: ReturnType<typeof setTimeout> | null = null;
    private promptingFileName = false;
    private fileNameBuffer = '';

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        this.context = context;
        this.buffer = new NanoEditorBuffer();
        this.renderer = new NanoEditorRenderer(context.terminal);
        this.promptingFileName = false;
        this.fileNameBuffer = '';
        this.statusMessage = undefined;

        // Try to get filesystem service (optional)
        try {
            this.fs = context.services.get<FileSystemLike>(FS_TOKEN);
        } catch {
            this.fs = null;
        }

        // Parse file path from command
        const args = (command.value || '').trim();
        if (args) {
            this.filePath = args;

            if (this.fs) {
                try {
                    const resolved = this.fs.resolvePath(this.filePath);
                    if (this.fs.exists(resolved) && !this.fs.isDirectory(resolved)) {
                        const content = this.fs.readFile(resolved);
                        if (content !== null) {
                            this.buffer.load(content);
                        }
                        this.filePath = resolved;
                    } else if (this.fs.exists(resolved) && this.fs.isDirectory(resolved)) {
                        context.writer.writeError(`${this.filePath} is a directory`);
                        return;
                    } else {
                        this.filePath = resolved;
                        // New file — empty buffer is fine
                    }
                } catch (e: any) {
                    context.writer.writeError(e.message || 'Error opening file');
                    return;
                }
            }
        } else {
            this.filePath = null;
        }

        // Enter editor mode
        this.renderer.enterAlternateScreen();
        this.renderer.render(this.buffer, this.filePath || 'New Buffer');

        // Handle terminal resize
        this.resizeDisposable = context.terminal.onResize(() => {
            this.renderer.render(
                this.buffer,
                this.filePath || 'New Buffer',
                this.statusMessage,
            );
        });

        // Set as context processor to intercept all input
        context.setContextProcessor(this, true);
    }

    async onData(data: string, context: ICliExecutionContext): Promise<void> {
        // If prompting for filename, handle that separately
        if (this.promptingFileName) {
            this.handleFileNameInput(data);
            return;
        }

        // Control characters (Ctrl+key sends 0x01-0x1A)
        if (data === '\x13') {
            // Ctrl+S — Save
            await this.save();
            return;
        }

        if (data === '\x11') {
            // Ctrl+Q — Quit
            this.quit();
            return;
        }

        if (data === '\x0B') {
            // Ctrl+K — Cut line
            this.buffer.deleteLine();
            this.render();
            return;
        }

        // Enter
        if (data === '\r') {
            this.buffer.insertNewline();
            this.render();
            return;
        }

        // Backspace
        if (data === '\x7F') {
            this.buffer.deleteCharBefore();
            this.render();
            return;
        }

        // Delete key (escape sequence)
        if (data === '\x1b[3~') {
            this.buffer.deleteCharAt();
            this.render();
            return;
        }

        // Arrow keys
        if (data === '\x1b[A') { this.buffer.moveUp(); this.render(); return; }
        if (data === '\x1b[B') { this.buffer.moveDown(); this.render(); return; }
        if (data === '\x1b[C') { this.buffer.moveRight(); this.render(); return; }
        if (data === '\x1b[D') { this.buffer.moveLeft(); this.render(); return; }

        // Home / End
        if (data === '\x1b[H' || data === '\x1b[1~') {
            this.buffer.moveHome();
            this.render();
            return;
        }
        if (data === '\x1b[F' || data === '\x1b[4~') {
            this.buffer.moveEnd();
            this.render();
            return;
        }

        // Ignore other escape sequences
        if (data.startsWith('\x1b')) {
            return;
        }

        // Ignore other control characters
        if (data.length === 1 && data.charCodeAt(0) < 32) {
            return;
        }

        // Printable text — insert
        this.buffer.insertChar(data);
        this.render();
    }

    writeDescription({ writer }: ICliExecutionContext): void {
        writer.writeln('Open the built-in nano-style text editor');
        writer.writeln();
        writer.writeln('Usage:');
        writer.writeln(`  ${writer.wrapInColor('nano', CliForegroundColor.Cyan)}                    Open empty scratch buffer`);
        writer.writeln(`  ${writer.wrapInColor('nano <file>', CliForegroundColor.Cyan)}              Open or create a file`);
        writer.writeln();
        writer.writeln('Keyboard shortcuts:');
        writer.writeln(`  ${writer.wrapInColor('^S', CliForegroundColor.Yellow)}  Save file`);
        writer.writeln(`  ${writer.wrapInColor('^Q', CliForegroundColor.Yellow)}  Quit editor`);
        writer.writeln(`  ${writer.wrapInColor('^K', CliForegroundColor.Yellow)}  Cut current line`);
    }

    private render(): void {
        this.renderer.render(
            this.buffer,
            this.filePath || 'New Buffer',
            this.statusMessage,
        );
    }

    private showStatus(message: string, duration = 2000): void {
        this.statusMessage = `  ${message}`;
        this.renderer.renderStatusOnly(this.buffer, this.statusMessage);

        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }
        this.statusTimeout = setTimeout(() => {
            this.statusMessage = undefined;
            this.render();
        }, duration);
    }

    private async save(): Promise<void> {
        if (!this.fs) {
            this.showStatus('No filesystem available — install @qodalis/cli-files');
            return;
        }

        if (!this.filePath) {
            // Prompt for filename
            this.promptingFileName = true;
            this.fileNameBuffer = '';
            this.renderer.renderStatusOnly(
                this.buffer,
                '  File Name to Write: ',
            );
            return;
        }

        try {
            const content = this.buffer.getContent();
            if (this.fs.exists(this.filePath)) {
                this.fs.writeFile(this.filePath, content);
            } else {
                this.fs.createFile(this.filePath, content);
            }
            await this.fs.persist();
            this.buffer.dirty = false;
            this.showStatus(`Saved ${this.filePath}`);
        } catch (e: any) {
            this.showStatus(`Error: ${e.message}`);
        }
    }

    private handleFileNameInput(data: string): void {
        if (data === '\r') {
            // Enter — confirm filename
            this.promptingFileName = false;
            const name = this.fileNameBuffer.trim();
            if (name) {
                this.filePath = this.fs!.resolvePath(name);
                this.save();
            } else {
                this.showStatus('Save cancelled');
            }
            return;
        }

        if (data === '\x1b' || data === '\x03') {
            // Escape or Ctrl+C — cancel
            this.promptingFileName = false;
            this.showStatus('Save cancelled');
            return;
        }

        if (data === '\x7F') {
            // Backspace
            if (this.fileNameBuffer.length > 0) {
                this.fileNameBuffer = this.fileNameBuffer.slice(0, -1);
            }
        } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
            // Printable character
            this.fileNameBuffer += data;
        } else {
            return; // Ignore other keys
        }

        this.renderer.renderStatusOnly(
            this.buffer,
            `  File Name to Write: ${this.fileNameBuffer}`,
        );
    }

    private quit(): void {
        if (this.buffer.dirty) {
            this.showStatus(
                'Unsaved changes! ^S to save, ^Q again to discard',
                3000,
            );
            // Temporarily rebind Ctrl+Q to force-quit
            const originalOnData = this.onData.bind(this);
            this.onData = async (data: string, ctx: ICliExecutionContext) => {
                if (data === '\x11') {
                    // Second Ctrl+Q — force quit
                    this.onData = originalOnData;
                    this.cleanup();
                    return;
                }
                if (data === '\x13') {
                    // Ctrl+S — save then restore normal mode
                    this.onData = originalOnData;
                    await this.save();
                    return;
                }
                // Any other key — cancel quit, restore normal mode
                this.onData = originalOnData;
                this.statusMessage = undefined;
                this.render();
                await this.onData(data, ctx);
            };
            return;
        }

        this.cleanup();
    }

    private cleanup(): void {
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }
        this.resizeDisposable?.dispose();
        this.renderer.leaveAlternateScreen();
        this.context.setContextProcessor(undefined);
        this.context.showPrompt();
    }
}
```

**Step 2: Build to verify**

```bash
npx ng build core && npx ng build cli
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add projects/cli/src/lib/editor/ projects/cli/src/lib/processors/system/cli-nano-command-processor.ts
git commit -m "feat(cli): add nano-style terminal text editor command"
```

---

### Task 6: Register Nano Processor in System Processors

Add the nano processor to the system processors array so it's included in boot.

**Files:**
- Modify: `projects/cli/src/lib/processors/system/index.ts`

**Step 1: Add import and registration**

Add to the imports section:

```typescript
import { CliNanoCommandProcessor } from './cli-nano-command-processor';
```

Add to the named exports:

```typescript
export { CliNanoCommandProcessor } from './cli-nano-command-processor';
```

Add to the `systemProcessors` array:

```typescript
    new CliNanoCommandProcessor(),
```

**Step 2: Build all to verify end-to-end**

```bash
npm run "build all"
```

Expected: All packages build successfully.

**Step 3: Commit**

```bash
git add projects/cli/src/lib/processors/system/index.ts
git commit -m "feat(cli): register nano command in system processors"
```

---

### Task 7: Manual Verification

Test the editor in the demo app to verify it works end-to-end.

**Step 1: Start the demo app**

```bash
npm run "start demo"
```

**Step 2: Test cases**

1. Type `nano` — should open empty editor with "New Buffer" title
2. Type some text, arrow keys to navigate, Backspace to delete
3. Press Ctrl+Q — should quit and restore terminal
4. Type `nano test.txt` — should open editor for new file
5. Type content, press Ctrl+S — should save and show "Saved" message
6. Press Ctrl+Q — quit
7. Type `cat test.txt` — should show the content you typed
8. Type `nano test.txt` — should open with existing content
9. Type `help` — nano should appear under System group
10. Type `help nano` — should show description with keyboard shortcuts

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(cli): nano editor adjustments from manual testing"
```

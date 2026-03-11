# Input Pipeline Refactoring — Design

## Goal

Break the 800-line `CliExecutionContext` god class into focused components with clean separation of concerns. Fix nano editor rendering issues as part of this. Enable easy addition of future full-screen modes (pager, less, etc.).

## Problem

`CliExecutionContext` currently handles: input routing, line editing, cursor management, command history, tab completion, reader input (4 types), selection, prompt rendering, progress bars, abort logic, and session management. Line buffer logic is duplicated 4x across command input, reader-line, reader-password, and the nano editor. Input routing is a chain of if/else with patches for each new mode. Terminal escape codes are scattered throughout.

## Architecture

Extract four internal components from `CliExecutionContext`. The public `ICliExecutionContext` interface does not change — all 47+ command processors continue working unchanged.

### Component 1: CliLineBuffer

Reusable text buffer with cursor management. Eliminates the 4x duplication.

**File:** `projects/cli/src/lib/input/cli-line-buffer.ts`

```typescript
class CliLineBuffer {
    text: string;
    cursorPosition: number;

    insert(str: string): void;
    deleteCharBefore(): void;    // Backspace
    deleteCharAt(): void;        // Delete key
    moveCursorLeft(): void;
    moveCursorRight(): void;
    moveHome(): void;
    moveEnd(): void;
    clear(): void;
    setText(str: string): void;  // Replace all, cursor to end
}
```

Used by CommandLineMode, ReaderMode, and available to any future mode.

### Component 2: IInputMode + Mode Classes

State machine for input routing. Each mode handles its own keys.

**File:** `projects/cli/src/lib/input/input-mode.ts`

```typescript
interface IInputMode {
    handleInput(data: string): Promise<void>;
    handleKeyEvent(event: KeyboardEvent): boolean;
    activate?(): void;
    deactivate?(): void;
}
```

**File:** `projects/cli/src/lib/input/command-line-mode.ts`

Handles: typing, Enter (execute), arrow up/down (history), tab (completion), Ctrl+C (abort), Ctrl+L (clear). Uses CliLineBuffer for text editing. Uses CliTerminalLineRenderer for display.

**File:** `projects/cli/src/lib/input/reader-mode.ts`

Handles: readLine, readPassword, readConfirm, readSelect. Uses CliLineBuffer for line/password input. Self-deactivates when user confirms or aborts (Ctrl+C, Escape).

**File:** `projects/cli/src/lib/input/raw-mode.ts`

Wraps a context processor's `onData` method. Bypasses all default key handling — `handleKeyEvent` only does `event.preventDefault()` for Ctrl keys (prevent browser interception) and returns true to let everything pass to `handleInput`. Used by nano editor and future full-screen commands.

### Component 3: CliTerminalLineRenderer

Extracts prompt rendering and line display.

**File:** `projects/cli/src/lib/input/cli-terminal-line-renderer.ts`

```typescript
class CliTerminalLineRenderer {
    constructor(terminal: Terminal);

    renderPrompt(options: PromptOptions): number;  // Returns prompt length
    refreshLine(buffer: CliLineBuffer, promptLength: number, previousLength?: number): void;
    clearLine(contentLength: number): void;
    getPromptString(options: PromptOptions): string;
}

interface PromptOptions {
    userName?: string;
    hideUserName?: boolean;
    contextProcessor?: string;
    pathProvider?: () => string | null;
}
```

Encapsulates all `\x1b[...]` escape sequences for line editing display.

### Component 4: Slimmed CliExecutionContext

**File:** `projects/cli/src/lib/context/cli-execution-context.ts` (modified)

Stays as the facade implementing `ICliExecutionContext`. Holds mode state:

```typescript
class CliExecutionContext {
    // Components
    readonly lineBuffer: CliLineBuffer;
    readonly lineRenderer: CliTerminalLineRenderer;
    private currentMode: IInputMode;
    private commandLineMode: CommandLineMode;

    // Input routing (tiny)
    initializeTerminalListeners(): void {
        this.terminal.onData(data => this.currentMode.handleInput(data));
        this.terminal.attachCustomKeyEventHandler(event =>
            event.type === 'keydown' ? this.currentMode.handleKeyEvent(event) : true
        );
    }

    // Mode switching
    pushMode(mode: IInputMode): void;   // Activate new mode
    popMode(): void;                     // Return to previous mode

    // Public API delegates (no change in signatures)
    showPrompt() { ... }
    clearLine() { ... }
    refreshCurrentLine() { ... }
    setCurrentLine() { ... }
    // etc.
}
```

Mode switching uses a stack: CommandLineMode is always at the bottom. ReaderMode pushes on top when readLine is called, pops when done. RawMode pushes when setContextProcessor is called with an onData processor.

## File Structure

```
projects/cli/src/lib/input/
    cli-line-buffer.ts           # Reusable text buffer
    input-mode.ts                # IInputMode interface
    command-line-mode.ts         # Normal CLI mode
    reader-mode.ts               # readLine/readPassword/etc
    raw-mode.ts                  # Full-screen processor mode
    cli-terminal-line-renderer.ts # Prompt and line display
```

## Migration Strategy

1. Create all new files alongside existing code
2. Refactor CliExecutionContext to delegate to new components
3. Remove duplicated code from CliExecutionContext
4. Update nano editor to work with RawMode
5. Verify all builds pass
6. Test manually

## Nano Editor Fix

The nano rendering issues are fixed as part of this refactoring:
- RawMode properly isolates the editor from CLI input handling
- No more interference between command-line rendering and editor rendering
- Clean activate/deactivate lifecycle for entering/leaving alternate screen
- The `handleKeyEvent` in RawMode correctly prevents browser defaults for all Ctrl keys

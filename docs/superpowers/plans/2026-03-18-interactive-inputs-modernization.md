# Interactive Inputs Modernization — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize all interactive terminal inputs — decompose the monolithic ReaderMode into per-type mode classes, add readDate and readFile, enhance existing inputs with search/filter/descriptions/groups/defaults/validation, modernize visuals, and fix resize/overflow bugs.

**Architecture:** Replace the 492-line `ReaderMode` with an abstract `InputModeBase` and 9 concrete mode classes (one per input type). `CliInputReader` becomes a factory that creates the appropriate mode and pushes it onto the mode stack. A new `InputModeHost` interface unifies the old `CliInputReaderHost` and `ReaderModeHost`. The file picker uses an `ICliFilePickerProvider` abstraction with Browser/Electron/Noop implementations.

**Tech Stack:** TypeScript, xterm.js, Angular 16, Jasmine/Karma (tests)

**Spec:** `docs/superpowers/specs/2026-03-18-interactive-inputs-modernization-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `packages/core/src/lib/interfaces/input-reader.ts` | Enhanced types + new types (modified in-place) |
| `packages/core/src/lib/interfaces/file-picker.ts` | `ICliFilePickerProvider`, `CliFilePickerOptions`, `CliFileResult` |
| `packages/cli/src/lib/input/modes/input-mode-base.ts` | Abstract base: abort, resolveAndPop, redrawLine, writeHelp |
| `packages/cli/src/lib/input/modes/line-input-mode.ts` | Free-text with default, validation, placeholder |
| `packages/cli/src/lib/input/modes/password-input-mode.ts` | Masked input |
| `packages/cli/src/lib/input/modes/confirm-input-mode.ts` | Y/N input |
| `packages/cli/src/lib/input/modes/select-input-mode.ts` | Vertical list with descriptions, groups, search, disabled |
| `packages/cli/src/lib/input/modes/inline-select-input-mode.ts` | Horizontal picker with overflow handling |
| `packages/cli/src/lib/input/modes/multi-select-input-mode.ts` | Checkbox list with select-all, search |
| `packages/cli/src/lib/input/modes/number-input-mode.ts` | Integer input with cursor nav |
| `packages/cli/src/lib/input/modes/date-input-mode.ts` | Date text input with format validation |
| `packages/cli/src/lib/input/modes/file-input-mode.ts` | Delegates to ICliFilePickerProvider |
| `packages/cli/src/lib/input/modes/index.ts` | Barrel export |
| `packages/cli/src/lib/services/file-picker/browser-file-picker-provider.ts` | Browser `<input type="file">` implementation |
| `packages/cli/src/lib/services/file-picker/noop-file-picker-provider.ts` | No-op for SSR/tests |
| `packages/cli/src/lib/services/file-picker/index.ts` | Barrel export |
| `packages/cli/src/tests/modes/input-mode-base.spec.ts` | Base class tests |
| `packages/cli/src/tests/modes/line-input-mode.spec.ts` | Line input tests |
| `packages/cli/src/tests/modes/password-input-mode.spec.ts` | Password input tests |
| `packages/cli/src/tests/modes/confirm-input-mode.spec.ts` | Confirm input tests |
| `packages/cli/src/tests/modes/select-input-mode.spec.ts` | Select input tests |
| `packages/cli/src/tests/modes/inline-select-input-mode.spec.ts` | Inline select tests |
| `packages/cli/src/tests/modes/multi-select-input-mode.spec.ts` | Multi-select tests |
| `packages/cli/src/tests/modes/number-input-mode.spec.ts` | Number input tests |
| `packages/cli/src/tests/modes/date-input-mode.spec.ts` | Date input tests |
| `packages/cli/src/tests/modes/file-input-mode.spec.ts` | File input tests |
| `packages/cli/src/tests/backward-compat.spec.ts` | Old-style call signatures still work |
| `packages/electron-cli/src/lib/services/electron-file-picker-provider.ts` | Electron dialog implementation |

### Modified Files

| File | Changes |
|---|---|
| `packages/core/src/lib/interfaces/input-reader.ts` | Add new option types, enhance CliSelectOption, update ICliInputReader |
| `packages/core/src/lib/interfaces/index.ts` | Re-export file-picker.ts |
| `packages/cli/src/lib/input/input-mode.ts` | Add `onResize?()` to IInputMode |
| `packages/cli/src/lib/input/index.ts` | Remove ReaderMode, add modes barrel |
| `packages/cli/src/lib/services/cli-input-reader.ts` | Refactor to factory pattern using InputModeHost |
| `packages/cli/src/lib/context/cli-execution-context.ts` | Implement InputModeHost, fix resize handling |
| `packages/cli/src/lib/testing/cli-test-harness.ts` | Add readDate, readFile to createQueuedReader |
| `packages/cli/src/tests/input-reader.spec.ts` | Update for new API signatures |
| `packages/electron-cli/src/lib/types.ts` | Extend ElectronCliApi.showOpenDialog |
| `packages/electron-cli/src/preload.ts` | Update showOpenDialog handler |

### Deleted Files

| File | Reason |
|---|---|
| `packages/cli/src/lib/input/reader-mode.ts` | Replaced by per-type modes |
| `packages/cli/src/tests/reader-mode.spec.ts` | Replaced by per-mode specs |

---

## Chunk 1: Core Interfaces & InputModeBase Foundation

### Task 1: Update core interfaces — enhanced types and new option interfaces

**Files:**
- Modify: `packages/core/src/lib/interfaces/input-reader.ts`

- [ ] **Step 1: Add new option types and enhance CliSelectOption**

Replace the entire file with the updated interfaces from the spec. Key changes:
- Add `description?`, `group?`, `disabled?` to `CliSelectOption`
- Add `CliLineOptions`, `CliSelectOptions`, `CliMultiSelectOptions`, `CliDateOptions`
- Update `ICliInputReader` method signatures (readLine gets options, readSelect/readSelectInline/readMultiSelect get options objects, add readDate and readFile)
- Full JSDoc on every type, field, and method

```typescript
/**
 * Represents an option for the readSelect and readSelectInline prompts.
 */
export interface CliSelectOption {
    /** Display text shown to the user */
    label: string;
    /** Value returned when this option is selected */
    value: string;
    /** Optional description shown as dimmed italic text after the label */
    description?: string;
    /** Group name — options sharing the same group are displayed under a group header */
    group?: string;
    /** When true, the option is visible but cannot be selected (rendered dimmed) */
    disabled?: boolean;
}

/**
 * Represents an option for the readMultiSelect prompt.
 */
export interface CliMultiSelectOption extends CliSelectOption {
    /** Whether the option is pre-selected */
    checked?: boolean;
}

/**
 * Options for readLine input.
 */
export interface CliLineOptions {
    /**
     * Pre-filled default value. Shown in the buffer when the prompt opens.
     * The cursor starts at the end of the default text. The text is rendered
     * normally (not dimmed) — it is real buffer content the user can edit.
     * Backspace works as usual to delete pre-filled characters.
     */
    default?: string;
    /**
     * Validation function called on Enter.
     * Return an error message string to reject the input and display the error.
     * Return null to accept the input.
     */
    validate?: (value: string) => string | null;
    /** Placeholder text shown dimmed when the buffer is empty */
    placeholder?: string;
}

/**
 * Options for readSelect and readSelectInline.
 */
export interface CliSelectOptions {
    /** Pre-select an option by its value */
    default?: string;
    /** Enable type-to-filter. When true, printable keystrokes filter the option list. Default: false. */
    searchable?: boolean;
    /** Callback invoked each time the highlighted option changes */
    onChange?: (value: string) => void;
}

/**
 * Options for readMultiSelect.
 */
export interface CliMultiSelectOptions {
    /** Enable type-to-filter. When true, printable keystrokes filter the option list. Default: false. */
    searchable?: boolean;
    /** Callback invoked each time the set of checked options changes */
    onChange?: (values: string[]) => void;
}

/**
 * Options for readDate input.
 */
export interface CliDateOptions {
    /**
     * Date format string. Supported tokens: YYYY (4-digit year), MM (2-digit month),
     * DD (2-digit day). Separators can be `-`, `/`, or `.`.
     * The separator in the format string is enforced — if format is 'YYYY-MM-DD',
     * the user must type dashes (not slashes or dots).
     * @default 'YYYY-MM-DD'
     */
    format?: string;
    /** Minimum allowed date in the same format as `format` */
    min?: string;
    /** Maximum allowed date in the same format as `format` */
    max?: string;
    /** Pre-filled default value */
    default?: string;
}

/**
 * Provides interactive input reading from the terminal.
 * All methods resolve with `null` when the user aborts (Ctrl+C or Escape).
 */
export interface ICliInputReader {
    readLine(prompt: string, options?: CliLineOptions): Promise<string | null>;
    readPassword(prompt: string): Promise<string | null>;
    readConfirm(prompt: string, defaultValue?: boolean): Promise<boolean | null>;
    readSelect(prompt: string, options: CliSelectOption[], selectOptions?: CliSelectOptions): Promise<string | null>;
    readSelectInline(prompt: string, options: CliSelectOption[], selectOptions?: CliSelectOptions): Promise<string | null>;
    readMultiSelect(prompt: string, options: CliMultiSelectOption[], selectOptions?: CliMultiSelectOptions): Promise<string[] | null>;
    readNumber(prompt: string, options?: { min?: number; max?: number; default?: number }): Promise<number | null>;
    readDate(prompt: string, options?: CliDateOptions): Promise<string | null>;
    readFile(prompt: string, options?: CliFilePickerOptions): Promise<CliFileResult[] | null>;
}
```

Copy the full JSDoc from the spec for each method.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx tsc --project packages/core/tsconfig.json --noEmit`
Expected: Errors in downstream packages (cli, electron-cli) that reference old signatures — that's expected and will be fixed in later tasks. Core itself should compile.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/lib/interfaces/input-reader.ts
git commit -m "feat(core): update ICliInputReader with enhanced types, readDate, readFile"
```

---

### Task 2: Add ICliFilePickerProvider interface and file picker types

**Files:**
- Create: `packages/core/src/lib/interfaces/file-picker.ts`
- Modify: `packages/core/src/lib/interfaces/index.ts`

- [ ] **Step 1: Create file-picker.ts with the provider interface and types**

```typescript
/**
 * Options for readFile file picker.
 */
export interface CliFilePickerOptions {
    /** Allow selecting multiple files. Default: false. */
    multiple?: boolean;
    /**
     * File type filter. Accepts MIME types (e.g. 'image/*') or extensions
     * (e.g. '.json,.txt'). Maps to the HTML accept attribute in browsers
     * and file filter in Electron.
     */
    accept?: string;
    /**
     * When true, pick a directory instead of files. Default: false.
     * Cannot be combined with `multiple` — if both are set, `directory` takes precedence
     * and a single directory is returned.
     */
    directory?: boolean;
    /**
     * How to read file content. Default: 'text'.
     * - 'text': Read as UTF-8 string (suitable for text files)
     * - 'arraybuffer': Read as ArrayBuffer (suitable for binary files like images)
     */
    readAs?: 'text' | 'arraybuffer';
}

/**
 * Result returned by readFile for each selected file.
 */
export interface CliFileResult {
    /** File name without path (e.g. 'config.json') */
    name: string;
    /** Full file path. Available in Electron, undefined in browser. */
    path?: string;
    /**
     * File content. Type depends on `CliFilePickerOptions.readAs`:
     * - 'text' (default): `string` (UTF-8 decoded)
     * - 'arraybuffer': `ArrayBuffer` (raw bytes)
     */
    content: string | ArrayBuffer;
    /** File size in bytes */
    size: number;
    /** MIME type (e.g. 'application/json', 'image/png') */
    type: string;
}

/**
 * Abstraction for environment-specific file picking.
 * Implementations handle the actual dialog interaction for their environment.
 */
export interface ICliFilePickerProvider {
    /** Whether file picking is supported in this environment */
    readonly isSupported: boolean;

    /**
     * Open a file picker dialog and return selected files.
     * @returns Array of selected files, or null if the user cancelled
     */
    pickFiles(options?: CliFilePickerOptions): Promise<CliFileResult[] | null>;

    /**
     * Open a directory picker dialog and return the selected directory.
     * @returns The selected directory, or null if the user cancelled
     */
    pickDirectory(): Promise<CliFileResult | null>;
}
```

- [ ] **Step 2: Add re-export to index.ts**

In `packages/core/src/lib/interfaces/index.ts`, add at the bottom (near the existing `export * from './file-transfer'`):

```typescript
export * from './file-picker';
```

- [ ] **Step 3: Verify core compiles**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx tsc --project packages/core/tsconfig.json --noEmit`
Expected: PASS (no errors in core)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/lib/interfaces/file-picker.ts packages/core/src/lib/interfaces/index.ts
git commit -m "feat(core): add ICliFilePickerProvider interface and file picker types"
```

---

### Task 3: Add onResize to IInputMode and create InputModeHost interface

**Files:**
- Modify: `packages/cli/src/lib/input/input-mode.ts`

- [ ] **Step 1: Add onResize to IInputMode**

Add to the `IInputMode` interface:

```typescript
    /** Called when the terminal is resized while this mode is active. */
    onResize?(cols: number, rows: number): void;
```

- [ ] **Step 2: Add InputModeHost interface to the same file**

Add below `IInputMode`:

```typescript
import { Terminal } from '@xterm/xterm';
import { ICliFilePickerProvider } from '@qodalis/cli-core';

/**
 * Host interface for input modes. Provides access to terminal I/O,
 * dimensions, and mode stack management.
 */
export interface InputModeHost {
    /** Write raw text/ANSI to the terminal */
    writeToTerminal(text: string): void;
    /** Get terminal row count for scroll window sizing */
    getTerminalRows(): number;
    /** Get terminal column count for overflow calculations */
    getTerminalCols(): number;
    /** Push a mode onto the input mode stack */
    pushMode(mode: IInputMode): void;
    /** Pop the current mode from the input mode stack */
    popMode(): void;
    /** The xterm.js Terminal instance (for direct write when needed) */
    readonly terminal: Terminal;
    /** File picker provider for the current environment */
    readonly filePickerProvider: ICliFilePickerProvider;
}
```

Note: The import for `Terminal` already exists via other input module files; the `@qodalis/cli-core` import path resolves via `tsconfig.base.json` path alias.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/lib/input/input-mode.ts
git commit -m "feat(cli): add onResize to IInputMode, add InputModeHost interface"
```

---

### Task 4: Create InputModeBase abstract class

**Files:**
- Create: `packages/cli/src/lib/input/modes/input-mode-base.ts`
- Create: `packages/cli/src/lib/input/modes/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/tests/modes/input-mode-base.spec.ts`:

```typescript
import { InputModeBase } from '../../lib/input/modes/input-mode-base';
import { InputModeHost } from '../../lib/input/input-mode';

class MockHost implements Partial<InputModeHost> {
    written: string[] = [];
    modePushed = false;
    modePopped = false;
    terminal = { rows: 24, cols: 80, write: (s: string) => this.written.push(s), writeln: (s: string) => this.written.push(s + '\n') } as any;
    filePickerProvider = { isSupported: false, pickFiles: async () => null, pickDirectory: async () => null };

    writeToTerminal(text: string): void { this.written.push(text); }
    getTerminalRows(): number { return 24; }
    getTerminalCols(): number { return 80; }
    pushMode(): void { this.modePushed = true; }
    popMode(): void { this.modePopped = true; }
}

class ConcreteMode extends InputModeBase<string> {
    async handleInput(_data: string): Promise<void> {}
}

describe('InputModeBase', () => {
    let host: MockHost;
    let mode: ConcreteMode;
    let resolved: string | null | undefined;

    beforeEach(() => {
        host = new MockHost();
        resolved = undefined;
        mode = new ConcreteMode(host as any, (val) => { resolved = val; });
    });

    it('should abort on Ctrl+C', () => {
        const event = new KeyboardEvent('keydown', { code: 'KeyC', ctrlKey: true });
        mode.handleKeyEvent(event);
        expect(resolved).toBeNull();
        expect(host.modePopped).toBe(true);
    });

    it('should abort on Escape', () => {
        const event = new KeyboardEvent('keydown', { code: 'Escape' });
        mode.handleKeyEvent(event);
        expect(resolved).toBeNull();
        expect(host.modePopped).toBe(true);
    });

    it('should resolve and pop on resolveAndPop', () => {
        mode.resolveAndPop('hello');
        expect(resolved).toBe('hello');
        expect(host.modePopped).toBe(true);
    });

    it('should redraw line correctly', () => {
        mode.redrawLine('Prompt: ', 'text', 4);
        expect(host.written.some(s => s.includes('Prompt: '))).toBe(true);
        expect(host.written.some(s => s.includes('text'))).toBe(true);
    });

    it('should write help text as dim', () => {
        mode.writeHelp('↑/↓ navigate');
        expect(host.written.some(s => s.includes('↑/↓ navigate'))).toBe(true);
        expect(host.written.some(s => s.includes('\x1b[2m'))).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx test cli --testFile=src/tests/modes/input-mode-base.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write InputModeBase implementation**

Create `packages/cli/src/lib/input/modes/input-mode-base.ts`:

```typescript
import { IInputMode, InputModeHost } from '../input-mode';

/**
 * Abstract base class for all interactive input modes.
 * Provides shared abort handling, resolve/cleanup, line redraw, and help bar rendering.
 *
 * @typeParam T The type of value this mode resolves with.
 */
export abstract class InputModeBase<T> implements IInputMode {
    private _resolved = false;
    /** Number of extra lines rendered below the prompt (help bar, error, etc.) */
    protected extraLines = 0;

    constructor(
        protected readonly host: InputModeHost,
        protected readonly resolve: (value: T | null) => void,
    ) {}

    abstract handleInput(data: string): Promise<void>;

    /**
     * Default key event handler. Aborts on Ctrl+C or Escape.
     * Subclasses may override for custom behavior (e.g., search-enabled modes
     * clear the filter first, abort on second press).
     */
    handleKeyEvent(event: KeyboardEvent): boolean {
        if (
            (event.code === 'KeyC' && event.ctrlKey) ||
            event.code === 'Escape'
        ) {
            this.abort();
            return false;
        }
        return true;
    }

    /**
     * Resolve the input promise with a value and pop this mode from the stack.
     */
    resolveAndPop(value: T): void {
        if (this._resolved) return;
        this._resolved = true;
        this.host.terminal.write('\r\n');
        this.host.popMode();
        this.resolve(value);
    }

    /**
     * Abort the input — resolve with null and pop.
     */
    protected abort(): void {
        if (this._resolved) return;
        this._resolved = true;
        this.host.terminal.write('\r\n');
        this.host.popMode();
        this.resolve(null);
    }

    /**
     * Clear the current line and redraw prompt + display text, positioning
     * the cursor at the given position.
     */
    redrawLine(promptText: string, displayText: string, cursorPosition: number): void {
        this.clearExtraLines();
        this.host.terminal.write('\x1b[2K\r');
        this.host.terminal.write(promptText + displayText);
        const cursorOffset = displayText.length - cursorPosition;
        if (cursorOffset > 0) {
            this.host.terminal.write(`\x1b[${cursorOffset}D`);
        }
    }

    /**
     * Render a dimmed help bar below the current line.
     */
    writeHelp(text: string): void {
        this.host.terminal.write(`\r\n    \x1b[2m${text}\x1b[0m`);
        this.extraLines++;
        // Move cursor back up to the input line
        this.host.terminal.write(`\x1b[${this.extraLines}A`);
        // Reposition at end of current line (caller should handle exact position)
    }

    /**
     * Write a validation error below the current line.
     */
    protected writeError(message: string): void {
        this.host.terminal.write(`\r\n  \x1b[31m✘ ${message}\x1b[0m`);
        this.extraLines++;
        this.host.terminal.write(`\x1b[${this.extraLines}A`);
    }

    /**
     * Clear any extra lines (help bar, errors) rendered below the prompt.
     */
    protected clearExtraLines(): void {
        if (this.extraLines > 0) {
            // Save cursor, go down, clear lines, restore cursor
            this.host.terminal.write('\x1b[s'); // save
            for (let i = 0; i < this.extraLines; i++) {
                this.host.terminal.write('\x1b[B\x1b[2K'); // down + clear
            }
            this.host.terminal.write('\x1b[u'); // restore
            this.extraLines = 0;
        }
    }
}
```

- [ ] **Step 4: Create modes/index.ts barrel**

Create `packages/cli/src/lib/input/modes/index.ts`:

```typescript
export { InputModeBase } from './input-mode-base';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx test cli --testFile=src/tests/modes/input-mode-base.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/lib/input/modes/ packages/cli/src/tests/modes/
git commit -m "feat(cli): add InputModeBase abstract class with abort, resolve, redraw, help"
```

---

## Chunk 2: Simple Input Modes (Line, Password, Confirm, Number)

### Task 5: Create LineInputMode

**Files:**
- Create: `packages/cli/src/lib/input/modes/line-input-mode.ts`
- Create: `packages/cli/src/tests/modes/line-input-mode.spec.ts`

- [ ] **Step 1: Write the failing tests**

Test scenarios:
- Text entry: type characters → buffer grows, resolve on Enter
- Cursor nav: Left/Right arrow keys move cursor within buffer
- Backspace mid-string: deletes char before cursor
- Default value: buffer pre-filled, cursor at end
- Placeholder: shown dimmed when buffer is empty, disappears on first keystroke
- Validation: on Enter with invalid input, shows error, stays active
- Multi-char paste: inserting multiple chars at once

Use MockHost from Task 4. Instantiate `LineInputMode` with prompt text and options.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx test cli --testFile=src/tests/modes/line-input-mode.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement LineInputMode**

```typescript
import { InputModeBase } from './input-mode-base';
import { InputModeHost } from '../input-mode';
import { CliLineOptions } from '@qodalis/cli-core';

export class LineInputMode extends InputModeBase<string> {
    private buffer: string;
    private cursorPosition: number;
    private hasError = false;

    constructor(
        host: InputModeHost,
        resolve: (value: string | null) => void,
        private readonly promptText: string,
        private readonly options?: CliLineOptions,
    ) {
        super(host, resolve);
        this.buffer = options?.default ?? '';
        this.cursorPosition = this.buffer.length;
    }

    activate(): void {
        // Render prompt with cyan ? prefix
        const prompt = `\x1b[36m?\x1b[0m ${this.promptText}`;
        this.host.writeToTerminal(prompt);
        if (this.buffer) {
            this.host.writeToTerminal(this.buffer);
        } else if (this.options?.placeholder) {
            this.host.writeToTerminal(`\x1b[2m${this.options.placeholder}\x1b[0m`);
            // Move cursor back to start (after prompt)
            this.host.terminal.write(`\x1b[${this.options.placeholder.length}D`);
        }
    }

    async handleInput(data: string): Promise<void> {
        if (this.hasError) {
            this.hasError = false;
            this.clearExtraLines();
        }

        if (data === '\r') {
            // Validate if validator provided
            if (this.options?.validate) {
                const error = this.options.validate(this.buffer);
                if (error) {
                    this.hasError = true;
                    this.writeError(error);
                    return;
                }
            }
            this.resolveAndPop(this.buffer);
        } else if (data === '\u007F') {
            // Backspace
            if (this.cursorPosition > 0) {
                this.buffer =
                    this.buffer.slice(0, this.cursorPosition - 1) +
                    this.buffer.slice(this.cursorPosition);
                this.cursorPosition--;
                this.renderLine();
            }
        } else if (data === '\u001B[D') {
            // Left arrow
            if (this.cursorPosition > 0) {
                this.cursorPosition--;
                this.host.terminal.write(data);
            }
        } else if (data === '\u001B[C') {
            // Right arrow
            if (this.cursorPosition < this.buffer.length) {
                this.cursorPosition++;
                this.host.terminal.write(data);
            }
        } else if (data.startsWith('\u001B')) {
            // Ignore other escape sequences
        } else {
            // Insert text at cursor
            const text = data.replace(/[\r\n]+/g, '');
            this.buffer =
                this.buffer.slice(0, this.cursorPosition) +
                text +
                this.buffer.slice(this.cursorPosition);
            this.cursorPosition += text.length;
            this.renderLine();
        }
    }

    onResize(): void {
        this.renderLine();
    }

    private renderLine(): void {
        const prompt = `\x1b[36m?\x1b[0m ${this.promptText}`;
        if (this.buffer.length === 0 && this.options?.placeholder) {
            this.redrawLine(prompt, `\x1b[2m${this.options.placeholder}\x1b[0m`, 0);
            // Move cursor to start of placeholder
            this.host.terminal.write(`\x1b[${this.options.placeholder.length}D`);
        } else {
            this.redrawLine(prompt, this.buffer, this.cursorPosition);
        }
    }
}
```

- [ ] **Step 4: Export from modes/index.ts**

Add to `packages/cli/src/lib/input/modes/index.ts`:
```typescript
export { LineInputMode } from './line-input-mode';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx test cli --testFile=src/tests/modes/line-input-mode.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/lib/input/modes/line-input-mode.ts packages/cli/src/tests/modes/line-input-mode.spec.ts packages/cli/src/lib/input/modes/index.ts
git commit -m "feat(cli): add LineInputMode with default, validation, placeholder support"
```

---

### Task 6: Create PasswordInputMode

**Files:**
- Create: `packages/cli/src/lib/input/modes/password-input-mode.ts`
- Create: `packages/cli/src/tests/modes/password-input-mode.spec.ts`

- [ ] **Step 1: Write failing tests**

Test: masked display (`*`), backspace, arrow keys ignored, Enter resolves.

- [ ] **Step 2: Run to verify fail**
- [ ] **Step 3: Implement PasswordInputMode**

Same structure as LineInputMode but:
- Display uses `'*'.repeat(buffer.length)` instead of raw buffer
- Arrow keys (Left/Right) are silently ignored — cursor always at end
- No validation, no placeholder, no default

- [ ] **Step 4: Export from modes/index.ts**
- [ ] **Step 5: Run to verify pass**
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(cli): add PasswordInputMode with masked display"
```

---

### Task 7: Create ConfirmInputMode

**Files:**
- Create: `packages/cli/src/lib/input/modes/confirm-input-mode.ts`
- Create: `packages/cli/src/tests/modes/confirm-input-mode.spec.ts`

- [ ] **Step 1: Write failing tests**

Test: accepts y/n only, rejects other chars, default value on empty Enter, displays (Y/n) or (y/N) hint.

- [ ] **Step 2: Run to verify fail**
- [ ] **Step 3: Implement ConfirmInputMode**

Extends `InputModeBase<boolean>`. Prompt shows cyan `?` prefix + hint. Only accepts `y` or `n` (case-insensitive). Enter with empty buffer uses defaultValue.

- [ ] **Step 4: Export from modes/index.ts**
- [ ] **Step 5: Run to verify pass**
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(cli): add ConfirmInputMode"
```

---

### Task 8: Create NumberInputMode

**Files:**
- Create: `packages/cli/src/lib/input/modes/number-input-mode.ts`
- Create: `packages/cli/src/tests/modes/number-input-mode.spec.ts`

- [ ] **Step 1: Write failing tests**

Test: digit entry, minus at position 0 only, cursor nav Left/Right (new — current code ignores arrows), min/max validation errors, default on empty Enter.

- [ ] **Step 2: Run to verify fail**
- [ ] **Step 3: Implement NumberInputMode**

Extends `InputModeBase<number>`. Same as current `handleNumberInput` but with Left/Right cursor navigation added (reuse the line redraw pattern from LineInputMode). Shows bounds hint and default in prompt. On validation failure, shows red error below line and stays active.

- [ ] **Step 4: Export from modes/index.ts**
- [ ] **Step 5: Run to verify pass**
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(cli): add NumberInputMode with cursor navigation"
```

---

## Chunk 3: Select Modes (Select, InlineSelect, MultiSelect)

### Task 9: Create SelectInputMode

**Files:**
- Create: `packages/cli/src/lib/input/modes/select-input-mode.ts`
- Create: `packages/cli/src/tests/modes/select-input-mode.spec.ts`

- [ ] **Step 1: Write failing tests**

Test scenarios:
- Arrow nav (Up/Down): selectedIndex changes, wraps at boundaries
- Enter: resolves with `options[selectedIndex].value`
- Scroll: when options > maxVisible, scroll offset adjusts
- Descriptions: rendered as dim italic after label
- Group headers: rendered as purple separators, skipped during navigation
- Disabled options: rendered dim, skipped during navigation
- Default selection: initializes selectedIndex to match `selectOptions.default` value
- onChange callback: fires on each navigation
- Search (when searchable=true): printable chars filter options, backspace clears filter, matched text highlighted yellow
- Search abort: first Escape clears filter, second Escape aborts

- [ ] **Step 2: Run to verify fail**
- [ ] **Step 3: Implement SelectInputMode**

Key implementation details:
- `activate()`: writes prompt line with cyan `?`, renders option list, writes help bar
- Internal state: `selectedIndex`, `scrollOffset`, `maxVisible`, `filter`, `filteredOptions`
- `handleInput()`: dispatches to arrow handlers, Enter, or search input
- `handleKeyEvent()`: overrides base for search-clear-first behavior when filter is non-empty
- Rendering: `❯` arrow, ANSI 256-color background on selected (`\x1b[48;5;24m`), dim descriptions, dim disabled options, purple group headers (`\x1b[35m`)
- `onResize(cols, rows)`: recalculates maxVisible, adjusts scrollOffset, re-renders
- Help bar: `"↑/↓ navigate · type to filter · enter to select · esc to cancel"` (if searchable), or `"↑/↓ navigate · enter to select · esc to cancel"` (if not)

- [ ] **Step 4: Export from modes/index.ts**
- [ ] **Step 5: Run to verify pass**
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(cli): add SelectInputMode with search, groups, descriptions, disabled options"
```

---

### Task 10: Create InlineSelectInputMode

**Files:**
- Create: `packages/cli/src/lib/input/modes/inline-select-input-mode.ts`
- Create: `packages/cli/src/tests/modes/inline-select-input-mode.spec.ts`

- [ ] **Step 1: Write failing tests**

Test scenarios:
- Left/Right navigation
- Enter resolves
- Overflow: when total option width > terminal cols, shows `◂`/`▸` indicators
- Scroll: visible window slides as selection moves past edge
- onChange callback
- Resize: recalculates visible window

- [ ] **Step 2: Run to verify fail**
- [ ] **Step 3: Implement InlineSelectInputMode**

Key implementation details:
- `activate()`: calculates which options fit within `host.getTerminalCols()`, renders visible window with `[ selected ]` brackets in cyan
- Internal state: `selectedIndex`, `visibleStart`, `visibleEnd`
- Overflow detection: sum of option label widths + padding > cols
- `◂` (U+25C2) shown when `visibleStart > 0`, `▸` (U+25B8) when `visibleEnd < options.length`
- `onResize(cols)`: recalculates visible window, re-renders

- [ ] **Step 4: Export from modes/index.ts**
- [ ] **Step 5: Run to verify pass**
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(cli): add InlineSelectInputMode with overflow handling"
```

---

### Task 11: Create MultiSelectInputMode

**Files:**
- Create: `packages/cli/src/lib/input/modes/multi-select-input-mode.ts`
- Create: `packages/cli/src/tests/modes/multi-select-input-mode.spec.ts`

- [ ] **Step 1: Write failing tests**

Test scenarios:
- Space toggles checked state
- Enter resolves with checked values
- Select all (`a` key): checks all, second `a` unchecks all
- Up/Down navigation with scroll
- Descriptions, groups, disabled (same as SelectInputMode)
- Search/filter (when searchable=true)
- onChange callback: fires on each toggle
- Pre-checked options from `CliMultiSelectOption.checked`

- [ ] **Step 2: Run to verify fail**
- [ ] **Step 3: Implement MultiSelectInputMode**

Same rendering structure as SelectInputMode but with:
- `◉` (U+25C9) / `○` (U+25CB) checkboxes instead of radio selection
- Space key toggles `checkedIndices`
- `a` key toggles all
- Help bar: `"N selected · space to toggle · a to select all · enter to confirm"`
- Shares search/filter logic with SelectInputMode (consider extracting a shared helper for filter logic if duplication is significant, but only if it's genuinely reusable — inline first)

- [ ] **Step 4: Export from modes/index.ts**
- [ ] **Step 5: Run to verify pass**
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(cli): add MultiSelectInputMode with select-all, search, modern checkboxes"
```

---

## Chunk 4: New Input Modes (Date, File) & File Picker Providers

### Task 12: Create DateInputMode

**Files:**
- Create: `packages/cli/src/lib/input/modes/date-input-mode.ts`
- Create: `packages/cli/src/tests/modes/date-input-mode.spec.ts`

- [ ] **Step 1: Write failing tests**

Test scenarios:
- YYYY-MM-DD format (default): accepts valid dates, rejects invalid
- MM/DD/YYYY format: separator enforced as `/`
- Invalid calendar dates: Feb 30, month 13, day 0
- Leap year: Feb 29 on leap year accepted, rejected on non-leap
- Min/max range: dates outside range rejected with error
- Default pre-fill: buffer initialized with default value
- Only allows digits and the format's separator character

- [ ] **Step 2: Run to verify fail**
- [ ] **Step 3: Implement DateInputMode**

Extends `InputModeBase<string>`. Behavior:
- `activate()`: renders prompt with format hint in dim parentheses, e.g., `? Start date (YYYY-MM-DD): `
- Keystroke handling: only accepts digits and the separator char extracted from the format string
- On Enter: parse the buffer according to format, validate as a real calendar date, check min/max range
- Validation errors shown as red `✘` below the line
- Cursor navigation (Left/Right) and backspace supported (like LineInputMode)

Date parsing logic: extract separator from format string (first non-alpha char), split format into parts to get positions of YYYY/MM/DD, parse buffer with same separator, construct Date and validate.

- [ ] **Step 4: Export from modes/index.ts**
- [ ] **Step 5: Run to verify pass**
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(cli): add DateInputMode with format validation, min/max range"
```

---

### Task 13: Create file picker providers (Browser, Noop)

**Files:**
- Create: `packages/cli/src/lib/services/file-picker/browser-file-picker-provider.ts`
- Create: `packages/cli/src/lib/services/file-picker/noop-file-picker-provider.ts`
- Create: `packages/cli/src/lib/services/file-picker/index.ts`

- [ ] **Step 1: Implement NoopFilePickerProvider**

```typescript
import { ICliFilePickerProvider, CliFilePickerOptions, CliFileResult } from '@qodalis/cli-core';

/**
 * No-op file picker for SSR and test environments.
 * Always returns null — file picking is not supported.
 */
export class NoopFilePickerProvider implements ICliFilePickerProvider {
    readonly isSupported = false;

    async pickFiles(_options?: CliFilePickerOptions): Promise<CliFileResult[] | null> {
        return null;
    }

    async pickDirectory(): Promise<CliFileResult | null> {
        return null;
    }
}
```

- [ ] **Step 2: Implement BrowserFilePickerProvider**

```typescript
import { ICliFilePickerProvider, CliFilePickerOptions, CliFileResult } from '@qodalis/cli-core';

/**
 * Browser-based file picker using the native `<input type="file">` element.
 * Creates a hidden input, triggers click(), reads selected files via FileReader.
 */
export class BrowserFilePickerProvider implements ICliFilePickerProvider {
    readonly isSupported = typeof document !== 'undefined';

    async pickFiles(options?: CliFilePickerOptions): Promise<CliFileResult[] | null> {
        if (!this.isSupported) return null;

        // If directory is set, it takes precedence
        if (options?.directory) {
            const dir = await this.pickDirectory();
            return dir ? [dir] : null;
        }

        return new Promise<CliFileResult[] | null>((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.style.display = 'none';

            if (options?.accept) input.accept = options.accept;
            if (options?.multiple) input.multiple = true;

            input.addEventListener('change', async () => {
                const files = input.files;
                if (!files || files.length === 0) {
                    resolve(null);
                    input.remove();
                    return;
                }

                const readAs = options?.readAs ?? 'text';
                const results: CliFileResult[] = [];

                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const content = await this.readFile(file, readAs);
                    results.push({
                        name: file.name,
                        content,
                        size: file.size,
                        type: file.type || 'application/octet-stream',
                    });
                }

                resolve(results);
                input.remove();
            });

            // Handle cancel (user closes dialog without selecting)
            input.addEventListener('cancel', () => {
                resolve(null);
                input.remove();
            });

            document.body.appendChild(input);
            input.click();
        });
    }

    async pickDirectory(): Promise<CliFileResult | null> {
        if (!this.isSupported) return null;

        return new Promise<CliFileResult | null>((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.style.display = 'none';
            (input as any).webkitdirectory = true;

            input.addEventListener('change', () => {
                const files = input.files;
                if (!files || files.length === 0) {
                    resolve(null);
                } else {
                    // Return directory info from first file's path
                    const firstFile = files[0];
                    const pathParts = (firstFile as any).webkitRelativePath?.split('/') ?? [];
                    const dirName = pathParts[0] || 'selected-directory';
                    resolve({
                        name: dirName,
                        content: '',
                        size: 0,
                        type: 'inode/directory',
                    });
                }
                input.remove();
            });

            input.addEventListener('cancel', () => {
                resolve(null);
                input.remove();
            });

            document.body.appendChild(input);
            input.click();
        });
    }

    private readFile(file: File, readAs: 'text' | 'arraybuffer'): Promise<string | ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string | ArrayBuffer);
            reader.onerror = () => reject(reader.error);
            if (readAs === 'arraybuffer') {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsText(file);
            }
        });
    }
}
```

- [ ] **Step 3: Create barrel index.ts**

```typescript
export { BrowserFilePickerProvider } from './browser-file-picker-provider';
export { NoopFilePickerProvider } from './noop-file-picker-provider';
```

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/lib/services/file-picker/
git commit -m "feat(cli): add BrowserFilePickerProvider and NoopFilePickerProvider"
```

---

### Task 14: Create FileInputMode

**Files:**
- Create: `packages/cli/src/lib/input/modes/file-input-mode.ts`
- Create: `packages/cli/src/tests/modes/file-input-mode.spec.ts`

- [ ] **Step 1: Write failing tests**

Test scenarios (using mock ICliFilePickerProvider):
- Single file: provider returns 1-element array → mode resolves with it
- Multiple files: provider returns array → mode resolves with array
- Cancel: provider returns null → mode resolves with null
- Unsupported: provider.isSupported = false → resolves null, writes warning
- Accept filter: options.accept passed through to provider
- Ctrl+C during wait: aborts

- [ ] **Step 2: Run to verify fail**
- [ ] **Step 3: Implement FileInputMode**

```typescript
import { InputModeBase } from './input-mode-base';
import { InputModeHost } from '../input-mode';
import { CliFilePickerOptions, CliFileResult } from '@qodalis/cli-core';

export class FileInputMode extends InputModeBase<CliFileResult[]> {
    private waiting = false;

    constructor(
        host: InputModeHost,
        resolve: (value: CliFileResult[] | null) => void,
        private readonly promptText: string,
        private readonly options?: CliFilePickerOptions,
    ) {
        super(host, resolve);
    }

    activate(): void {
        const provider = this.host.filePickerProvider;

        // Show accept filter hint if provided
        const acceptHint = this.options?.accept ? ` \x1b[2m(${this.options.accept})\x1b[0m` : '';
        this.host.writeToTerminal(`\x1b[36m?\x1b[0m ${this.promptText}${acceptHint}: `);

        if (!provider.isSupported) {
            this.host.writeToTerminal('\x1b[2m(file picker not available)\x1b[0m\r\n');
            this.host.popMode();
            this.resolve(null);
            return;
        }

        this.host.writeToTerminal('\x1b[33mOpening file picker...\x1b[0m');
        this.waiting = true;

        this.pickFiles(provider);
    }

    private async pickFiles(provider: typeof this.host.filePickerProvider): Promise<void> {
        try {
            let results: CliFileResult[] | null;
            if (this.options?.directory) {
                const dir = await provider.pickDirectory();
                results = dir ? [dir] : null;
            } else {
                results = await provider.pickFiles(this.options);
            }

            this.waiting = false;

            if (!results) {
                // Clear "Opening file picker..." and show cancelled
                this.host.terminal.write('\x1b[2K\r');
                this.host.writeToTerminal(`\x1b[36m?\x1b[0m ${this.promptText}: \x1b[2m(cancelled)\x1b[0m\r\n`);
                this.host.popMode();
                this.resolve(null);
                return;
            }

            // Clear "Opening file picker..." line and show results
            this.host.terminal.write('\x1b[2K\r');
            this.host.writeToTerminal(`\x1b[36m?\x1b[0m ${this.promptText}:\r\n`);
            let totalSize = 0;
            for (const file of results) {
                const sizeStr = this.formatSize(file.size);
                this.host.writeToTerminal(`  \x1b[32m✔\x1b[0m ${file.name} \x1b[2m(${sizeStr})\x1b[0m\r\n`);
                totalSize += file.size;
            }
            if (results.length > 1) {
                this.host.writeToTerminal(`    \x1b[2m${results.length} files selected · ${this.formatSize(totalSize)} total\x1b[0m\r\n`);
            }

            this.host.popMode();
            this.resolve(results);
        } catch {
            this.waiting = false;
            this.host.terminal.write('\x1b[2K\r');
            this.host.writeToTerminal(`\x1b[36m?\x1b[0m ${this.promptText}: \x1b[31m(error)\x1b[0m\r\n`);
            this.host.popMode();
            this.resolve(null);
        }
    }

    async handleInput(_data: string): Promise<void> {
        // No keystroke handling — waiting for async dialog
    }

    private formatSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
}
```

- [ ] **Step 4: Export from modes/index.ts**
- [ ] **Step 5: Run to verify pass**
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(cli): add FileInputMode with browser/electron file picker delegation"
```

---

## Chunk 5: Refactor CliInputReader & CliExecutionContext, Wire Everything

### Task 15: Refactor CliInputReader to factory pattern

**Files:**
- Modify: `packages/cli/src/lib/services/cli-input-reader.ts`

- [ ] **Step 1: Rewrite CliInputReader**

Replace the entire class. It no longer creates `ActiveInputRequest` objects — it creates mode instances and pushes them onto the stack:

```typescript
import {
    ICliInputReader,
    CliSelectOption,
    CliMultiSelectOption,
    CliLineOptions,
    CliSelectOptions,
    CliMultiSelectOptions,
    CliDateOptions,
    CliFilePickerOptions,
    CliFileResult,
} from '@qodalis/cli-core';
import { InputModeHost } from '../input/input-mode';
import {
    LineInputMode,
    PasswordInputMode,
    ConfirmInputMode,
    SelectInputMode,
    InlineSelectInputMode,
    MultiSelectInputMode,
    NumberInputMode,
    DateInputMode,
    FileInputMode,
} from '../input/modes';

/**
 * Factory-based input reader. Creates the appropriate input mode
 * and pushes it onto the mode stack for each request.
 */
export class CliInputReader implements ICliInputReader {
    constructor(private readonly host: InputModeHost) {}

    readLine(prompt: string, options?: CliLineOptions): Promise<string | null> {
        return new Promise<string | null>((resolve) => {
            const mode = new LineInputMode(this.host, resolve, prompt, options);
            this.host.pushMode(mode);
        });
    }

    readPassword(prompt: string): Promise<string | null> {
        return new Promise<string | null>((resolve) => {
            const mode = new PasswordInputMode(this.host, resolve, prompt);
            this.host.pushMode(mode);
        });
    }

    readConfirm(prompt: string, defaultValue: boolean = false): Promise<boolean | null> {
        return new Promise<boolean | null>((resolve) => {
            const mode = new ConfirmInputMode(this.host, resolve, prompt, defaultValue);
            this.host.pushMode(mode);
        });
    }

    readSelect(prompt: string, options: CliSelectOption[], selectOptions?: CliSelectOptions): Promise<string | null> {
        if (!options || options.length === 0) {
            return Promise.reject(new Error('readSelect requires at least one option'));
        }
        return new Promise<string | null>((resolve) => {
            const mode = new SelectInputMode(this.host, resolve, prompt, options, selectOptions);
            this.host.pushMode(mode);
        });
    }

    readSelectInline(prompt: string, options: CliSelectOption[], selectOptions?: CliSelectOptions): Promise<string | null> {
        if (!options || options.length === 0) {
            return Promise.reject(new Error('readSelectInline requires at least one option'));
        }
        return new Promise<string | null>((resolve) => {
            const mode = new InlineSelectInputMode(this.host, resolve, prompt, options, selectOptions);
            this.host.pushMode(mode);
        });
    }

    readMultiSelect(prompt: string, options: CliMultiSelectOption[], selectOptions?: CliMultiSelectOptions): Promise<string[] | null> {
        if (!options || options.length === 0) {
            return Promise.reject(new Error('readMultiSelect requires at least one option'));
        }
        return new Promise<string[] | null>((resolve) => {
            const mode = new MultiSelectInputMode(this.host, resolve, prompt, options, selectOptions);
            this.host.pushMode(mode);
        });
    }

    readNumber(prompt: string, options?: { min?: number; max?: number; default?: number }): Promise<number | null> {
        return new Promise<number | null>((resolve) => {
            const mode = new NumberInputMode(this.host, resolve, prompt, options);
            this.host.pushMode(mode);
        });
    }

    readDate(prompt: string, options?: CliDateOptions): Promise<string | null> {
        return new Promise<string | null>((resolve) => {
            const mode = new DateInputMode(this.host, resolve, prompt, options);
            this.host.pushMode(mode);
        });
    }

    readFile(prompt: string, options?: CliFilePickerOptions): Promise<CliFileResult[] | null> {
        return new Promise<CliFileResult[] | null>((resolve) => {
            const mode = new FileInputMode(this.host, resolve, prompt, options);
            this.host.pushMode(mode);
        });
    }
}
```

Remove the old `ActiveInputRequest`, `ActiveInputRequestType`, `CliInputReaderHost` exports. If other files import these, they will be updated in the next step.

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/lib/services/cli-input-reader.ts
git commit -m "refactor(cli): rewrite CliInputReader as mode factory, remove ActiveInputRequest"
```

---

### Task 16: Refactor CliExecutionContext to implement InputModeHost

**Files:**
- Modify: `packages/cli/src/lib/context/cli-execution-context.ts`
- Modify: `packages/cli/src/lib/input/index.ts`

- [ ] **Step 1: Update CliExecutionContext**

Key changes:
1. Replace `implements CliInputReaderHost, ReaderModeHost` with `implements InputModeHost`
2. Remove `_activeInputRequest` field and `get activeInputRequest()` / `setActiveInputRequest()` methods
3. Add `getTerminalCols(): number` method (returns `this.terminal.cols`)
4. Add `filePickerProvider` property — initialize in constructor based on environment
5. Remove `ReaderMode` import — no longer pushed manually
6. Update `handleTerminalResize()`: remove the `this._activeInputRequest` early return, instead call `this.currentMode?.onResize?.(this.terminal.cols, this.terminal.rows)`
7. Pass `this` (as `InputModeHost`) to `new CliInputReader(this)`

Import changes:
- Remove `ActiveInputRequest`, `CliInputReaderHost` from `../services/cli-input-reader`
- Remove `ReaderMode`, `ReaderModeHost` from `../input`
- Add `InputModeHost` from `../input/input-mode`
- Add `BrowserFilePickerProvider`, `NoopFilePickerProvider` from `../services/file-picker`
- Add `ICliFilePickerProvider` from `@qodalis/cli-core`

The `pushMode` and `popMode` methods are already public — no change needed.

In the constructor, initialize file picker:
```typescript
// After existing initialization
this.filePickerProvider = typeof document !== 'undefined'
    ? new BrowserFilePickerProvider()
    : new NoopFilePickerProvider();
// If window.electronCliApi exists, electron-cli module will override this
```

In `handleTerminalResize()`, replace lines 353-358:
```typescript
// OLD: if (this._activeInputRequest) return;
// NEW:
const mode = this.currentMode;
if (mode?.onResize) {
    mode.onResize(this.terminal.cols, this.terminal.rows);
    return;
}
```

- [ ] **Step 2: Update input/index.ts**

Remove: `export { ReaderMode, ReaderModeHost } from './reader-mode';`
Add: `export { InputModeHost } from './input-mode';`
Add: `export * from './modes';`

- [ ] **Step 3: Verify it compiles**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx build cli`
Expected: PASS (may have warnings, no errors)

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/lib/context/cli-execution-context.ts packages/cli/src/lib/input/index.ts
git commit -m "refactor(cli): CliExecutionContext implements InputModeHost, fix resize handling"
```

---

### Task 17: Delete old ReaderMode and update tests

**Files:**
- Delete: `packages/cli/src/lib/input/reader-mode.ts`
- Delete: `packages/cli/src/tests/reader-mode.spec.ts`
- Modify: `packages/cli/src/tests/input-reader.spec.ts`

- [ ] **Step 1: Delete old files**

```bash
rm packages/cli/src/lib/input/reader-mode.ts
rm packages/cli/src/tests/reader-mode.spec.ts
```

- [ ] **Step 2: Update input-reader.spec.ts**

The test uses `MockHost` that implements `CliInputReaderHost`. Rewrite to use `InputModeHost`:

```typescript
import { CliInputReader } from '../lib/services/cli-input-reader';
import { InputModeHost, IInputMode } from '../lib/input/input-mode';
import { NoopFilePickerProvider } from '../lib/services/file-picker';

class MockHost implements InputModeHost {
    written: string[] = [];
    pushedModes: IInputMode[] = [];
    terminal = {
        rows: 24,
        cols: 80,
        write: (s: string) => this.written.push(s),
        writeln: (s: string) => this.written.push(s + '\n'),
    } as any;
    filePickerProvider = new NoopFilePickerProvider();

    writeToTerminal(text: string): void { this.written.push(text); }
    getTerminalRows(): number { return 24; }
    getTerminalCols(): number { return 80; }
    pushMode(mode: IInputMode): void {
        this.pushedModes.push(mode);
        mode.activate?.();
    }
    popMode(): void { this.pushedModes.pop(); }

    reset(): void {
        this.written = [];
        this.pushedModes = [];
    }
}
```

Update all tests to assert on pushed modes rather than `activeInputRequest`. For example:
- `readLine('Name: ')` → verify a mode was pushed and prompt text was written
- `readSelect('Pick:', [])` → verify rejection
- `readSelect('Pick:', options, { onChange })` → verify mode pushed (note: now uses options object)

Also add tests for `readDate` and `readFile`.

- [ ] **Step 3: Run all cli tests**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx test cli`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A packages/cli/src/
git commit -m "refactor(cli): delete ReaderMode, update tests for new mode architecture"
```

---

### Task 18: Update test harness and create backward-compat tests

**Files:**
- Modify: `packages/cli/src/lib/testing/cli-test-harness.ts`
- Create: `packages/cli/src/tests/backward-compat.spec.ts`

- [ ] **Step 1: Update createQueuedReader**

In `packages/cli/src/lib/testing/cli-test-harness.ts`, add `readDate` and `readFile` to the queued reader:

```typescript
function createQueuedReader(queue: any[]): ICliInputReader {
    let index = 0;
    const next = () => queue[index++];
    return {
        readLine: async () => next() ?? '',
        readPassword: async () => next() ?? '',
        readConfirm: async () => next() ?? false,
        readSelect: async () => next() ?? '',
        readSelectInline: async () => next() ?? '',
        readMultiSelect: async () => next() ?? [],
        readNumber: async () => next() ?? 0,
        readDate: async () => next() ?? '',
        readFile: async () => next() ?? null,
    };
}
```

- [ ] **Step 2: Create backward-compat.spec.ts**

Tests that old-style call signatures still work:
```typescript
// readLine with just prompt (no options)
reader.readLine('Name: ')
// readSelect with 2 args (no selectOptions)
reader.readSelect('Pick:', options)
// readMultiSelect with 2 args
reader.readMultiSelect('Select:', multiOptions)
// readNumber with just prompt
reader.readNumber('Count')
```

- [ ] **Step 3: Run all cli tests**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx test cli`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/lib/testing/cli-test-harness.ts packages/cli/src/tests/backward-compat.spec.ts
git commit -m "test(cli): update test harness with readDate/readFile, add backward compat tests"
```

---

## Chunk 6: Electron File Picker & Full Build Verification

### Task 19: Update Electron file picker types and provider

**Files:**
- Modify: `packages/electron-cli/src/lib/types.ts`
- Create: `packages/electron-cli/src/lib/services/electron-file-picker-provider.ts`
- Modify: `packages/electron-cli/src/preload.ts`

- [ ] **Step 1: Update ElectronCliApi types**

In `packages/electron-cli/src/lib/types.ts`, update `showOpenDialog`:

```typescript
showOpenDialog(options?: {
    accept?: string;
    multiple?: boolean;
    directory?: boolean;
    readAs?: 'text' | 'arraybuffer';
}): Promise<{ name: string; content: string | ArrayBuffer; path: string; size: number; type: string }[] | null>;
```

- [ ] **Step 2: Create ElectronFilePickerProvider**

```typescript
import { ICliFilePickerProvider, CliFilePickerOptions, CliFileResult } from '@qodalis/cli-core';

export class ElectronFilePickerProvider implements ICliFilePickerProvider {
    readonly isSupported = typeof window !== 'undefined' && !!(window as any).electronCliApi;

    async pickFiles(options?: CliFilePickerOptions): Promise<CliFileResult[] | null> {
        const api = (window as any).electronCliApi;
        if (!api) return null;

        const results = await api.showOpenDialog({
            accept: options?.accept,
            multiple: options?.multiple,
            directory: options?.directory,
            readAs: options?.readAs,
        });

        if (!results) return null;

        return results.map((r: any) => ({
            name: r.name,
            path: r.path,
            content: r.content,
            size: r.size,
            type: r.type || 'application/octet-stream',
        }));
    }

    async pickDirectory(): Promise<CliFileResult | null> {
        const results = await this.pickFiles({ directory: true });
        return results?.[0] ?? null;
    }
}
```

- [ ] **Step 3: Update preload.ts**

Update the `showOpenDialog` handler in the preload script to match the new signature — return an array with `path`, `size`, `type` fields. This depends on the existing preload structure; read it first and modify accordingly.

- [ ] **Step 4: Commit**

```bash
git add packages/electron-cli/
git commit -m "feat(electron-cli): update showOpenDialog for new file picker API"
```

---

### Task 20: Full build and test verification

**Files:** None (verification only)

- [ ] **Step 1: Build all packages**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && pnpm run build`
Expected: All 31+ projects build successfully. Fix any compilation errors.

- [ ] **Step 2: Run all tests**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && pnpm test`
Expected: All tests pass. Fix any failures.

- [ ] **Step 3: Kill any lingering processes**

```bash
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
ps aux | grep "nx.js\|karma\|ChromeHeadless" | grep -v grep
```

- [ ] **Step 4: Commit any build fixes**

```bash
git add -A
git commit -m "fix: resolve build and test issues from inputs modernization"
```

---

## Chunk 7: Documentation & Cleanup

### Task 21: Verify all JSDoc documentation is complete

**Files:**
- `packages/core/src/lib/interfaces/input-reader.ts`
- `packages/core/src/lib/interfaces/file-picker.ts`
- All files in `packages/cli/src/lib/input/modes/`

- [ ] **Step 1: Review all public exports for JSDoc completeness**

Every exported type, interface, class, method, and property must have JSDoc. Check:
- `ICliInputReader` — all 9 methods with `@param` and `@returns`
- `CliSelectOption`, `CliMultiSelectOption` — all fields
- `CliLineOptions`, `CliSelectOptions`, `CliMultiSelectOptions`, `CliDateOptions` — all fields
- `CliFilePickerOptions`, `CliFileResult`, `ICliFilePickerProvider` — all fields and methods
- `InputModeBase` — public and protected methods
- Each concrete mode class — constructor, `handleInput`, `onResize`

- [ ] **Step 2: Fix any missing documentation**
- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: ensure complete JSDoc on all interactive input public APIs"
```

---

### Task 22: Final cleanup

- [ ] **Step 1: Verify no references to deleted ReaderMode remain**

```bash
grep -r "ReaderMode\|ReaderModeHost\|ActiveInputRequest\|CliInputReaderHost" packages/cli/src/ packages/core/src/ --include="*.ts" | grep -v node_modules | grep -v dist
```

Expected: No matches (except possibly in git history/comments — check each)

- [ ] **Step 2: Verify no references to old onChange signature**

```bash
grep -rn "readSelect.*,.*,\s*(" packages/ --include="*.ts" | grep -v node_modules | grep -v dist | grep -v spec
```

Expected: No matches in non-test code

- [ ] **Step 3: Run final build + test**

```bash
cd /home/nicolae/work/cli-workspace/web-cli && pnpm run build && pnpm test
```

- [ ] **Step 4: Kill all processes**

```bash
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

- [ ] **Step 5: Final commit if any cleanup was needed**

```bash
git add -A
git commit -m "chore: cleanup stale references from inputs modernization"
```

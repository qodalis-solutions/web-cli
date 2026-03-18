# Interactive Inputs Modernization

**Date:** 2026-03-18
**Status:** Draft
**Scope:** `packages/core` (interfaces), `packages/cli` (implementation), `packages/electron-cli` (file picker)

## Overview

Modernize all 7 existing interactive input types in `ICliInputReader`, add 2 new input types (`readDate`, `readFile`), fix existing bugs, and refactor the monolithic `ReaderMode` into focused per-type mode classes. All public APIs get full JSDoc documentation for IntelliSense support.

## Goals

1. **Decomposed architecture** — Replace the 492-line `ReaderMode` with individual mode classes per input type
2. **New inputs** — `readDate` (text with format validation), `readFile` (environment-aware file picker)
3. **Enhanced existing inputs** — Search/filter, option descriptions, group headers, defaults, validation, select-all
4. **Visual modernization** — Consistent prompt style, better highlight contrast, help bars, modern symbols
5. **Bug fixes** — `readSelectInline` overflow, terminal resize during active input
6. **JSDoc documentation** — Full documentation on all public types, interfaces, methods, and options

## Architecture

### Current State

```
ICliInputReader (7 methods)
  └─ CliInputReader (request creation + initial rendering)
       └─ ReaderMode (ALL keystroke handling + ALL redraw logic, 492 lines)
            - 7 handleXxxInput() methods
            - 4 redrawXxx() methods
            - Shared via ActiveInputRequest union type with many optional fields
```

### Proposed State

```
ICliInputReader (9 methods)
  └─ CliInputReader (factory → delegates to per-type modes)
       └─ InputModeBase (abstract)
            ├─ LineInputMode
            ├─ PasswordInputMode
            ├─ ConfirmInputMode
            ├─ SelectInputMode
            ├─ InlineSelectInputMode
            ├─ MultiSelectInputMode
            ├─ NumberInputMode
            ├─ DateInputMode       (NEW)
            └─ FileInputMode       (NEW)
```

### InputModeBase

Abstract base class providing shared behavior for all input modes:

- `resolveAndPop(value: T)` — Sets active request to null, pops mode from stack, resolves promise
- `abort()` — Resolves with `null`, performs cleanup
- `handleKeyEvent(event: KeyboardEvent): boolean` — Ctrl+C and Escape both call `abort()`
- `redrawLine(promptText: string, displayText: string, cursorPosition: number)` — The `\x1b[2K\r` + rewrite + cursor-reposition pattern
- `writeHelp(text: string)` — Renders the dimmed help bar below input

Each concrete mode holds its own typed state internally. The `ActiveInputRequest` union with optional fields is eliminated — each mode class defines exactly the state it needs as private fields.

### File Layout

New files under `packages/cli/src/lib/input/modes/`:

```
modes/
  input-mode-base.ts
  line-input-mode.ts
  password-input-mode.ts
  confirm-input-mode.ts
  select-input-mode.ts
  inline-select-input-mode.ts
  multi-select-input-mode.ts
  number-input-mode.ts
  date-input-mode.ts
  file-input-mode.ts
  index.ts
```

Deleted files:
- `packages/cli/src/lib/input/reader-mode.ts` (replaced by individual modes)

Modified files:
- `packages/cli/src/lib/services/cli-input-reader.ts` — Becomes a factory that creates and pushes the appropriate mode
- `packages/cli/src/lib/input/input-mode.ts` — Add optional `onResize?()` method
- `packages/cli/src/lib/context/cli-execution-context.ts` — Remove `ActiveInputRequest`-based early return in `handleTerminalResize()`, delegate to `currentMode.onResize()`
- `packages/cli/src/lib/input/index.ts` — Re-export new modes, remove `ReaderMode`

## Interface Changes

### Enhanced Existing Types (packages/core)

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
```

### New Types (packages/core)

```typescript
/**
 * Options for readLine input.
 */
export interface CliLineOptions {
    /** Pre-filled default value. Shown in the buffer when the prompt opens. */
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
    /** When true, pick a directory instead of files. Default: false. */
    directory?: boolean;
}

/**
 * Result returned by readFile for each selected file.
 */
export interface CliFileResult {
    /** File name without path (e.g. 'config.json') */
    name: string;
    /** Full file path. Available in Electron, undefined in browser. */
    path?: string;
    /** File content as text (UTF-8) or ArrayBuffer (binary) */
    content: string | ArrayBuffer;
    /** File size in bytes */
    size: number;
    /** MIME type (e.g. 'application/json', 'image/png') */
    type: string;
}
```

### Updated ICliInputReader Interface

```typescript
/**
 * Provides interactive input reading from the terminal.
 * All methods resolve with `null` when the user aborts (Ctrl+C or Escape).
 */
export interface ICliInputReader {
    /**
     * Prompt the user for a line of text input.
     * Supports cursor navigation (Left/Right), backspace, and paste.
     * @param prompt The prompt text to display (e.g. "Enter your name: ")
     * @param options Optional configuration for default value, validation, and placeholder
     * @returns The entered text, empty string if Enter pressed with no input, or null if aborted
     */
    readLine(prompt: string, options?: CliLineOptions): Promise<string | null>;

    /**
     * Prompt the user for password input. Characters are masked with asterisks.
     * Arrow keys are ignored for security.
     * @param prompt The prompt text to display (e.g. "Password: ")
     * @returns The entered password, empty string if Enter pressed with no input, or null if aborted
     */
    readPassword(prompt: string): Promise<string | null>;

    /**
     * Prompt the user for a yes/no confirmation.
     * Accepts only 'y' or 'n' (case-insensitive). Enter with empty input uses the default.
     * @param prompt The prompt text to display (e.g. "Continue?")
     * @param defaultValue The default value when Enter is pressed without input (defaults to false)
     * @returns true for yes, false for no, defaultValue on empty Enter, or null if aborted
     */
    readConfirm(prompt: string, defaultValue?: boolean): Promise<boolean | null>;

    /**
     * Prompt the user to select from a vertical list of options using Up/Down arrow keys.
     * Supports option descriptions, group headers, disabled options, default selection,
     * and optional type-to-filter search.
     * @param prompt The prompt text to display (e.g. "Pick one:")
     * @param options The list of options to choose from
     * @param selectOptions Optional configuration for default, search, and onChange callback
     * @returns The value of the selected option, or null if aborted
     */
    readSelect(
        prompt: string,
        options: CliSelectOption[],
        selectOptions?: CliSelectOptions,
    ): Promise<string | null>;

    /**
     * Prompt the user to select from a horizontal single-line option picker.
     * Navigate with Left/Right arrow keys. Handles overflow gracefully when
     * options exceed terminal width by showing scroll indicators.
     * @param prompt The prompt text to display
     * @param options The list of options to choose from
     * @param selectOptions Optional configuration for default, search, and onChange callback
     * @returns The value of the selected option, or null if aborted
     */
    readSelectInline(
        prompt: string,
        options: CliSelectOption[],
        selectOptions?: CliSelectOptions,
    ): Promise<string | null>;

    /**
     * Prompt the user to select multiple items from a checkbox list.
     * Navigate with Up/Down, toggle with Space, confirm with Enter.
     * Press 'a' to select/deselect all. Supports type-to-filter search.
     * @param prompt The prompt text to display
     * @param options The list of options with optional pre-checked state
     * @param selectOptions Optional configuration for search and onChange callback
     * @returns Array of selected values, or null if aborted
     */
    readMultiSelect(
        prompt: string,
        options: CliMultiSelectOption[],
        selectOptions?: CliMultiSelectOptions,
    ): Promise<string[] | null>;

    /**
     * Prompt the user for numeric input with optional min/max validation.
     * Supports cursor navigation (Left/Right), backspace, and negative numbers.
     * @param prompt The prompt text to display
     * @param options Optional constraints: min, max, and default value
     * @returns The entered number, or null if aborted
     */
    readNumber(
        prompt: string,
        options?: { min?: number; max?: number; default?: number },
    ): Promise<number | null>;

    /**
     * Prompt the user for a date input with format validation.
     * The user types a date string; validation runs on Enter and shows
     * inline errors for invalid dates or out-of-range values.
     * @param prompt The prompt text to display
     * @param options Optional configuration for format, min/max range, and default
     * @returns The entered date string in the configured format, or null if aborted
     */
    readDate(prompt: string, options?: CliDateOptions): Promise<string | null>;

    /**
     * Open a file picker dialog appropriate to the environment.
     * In browsers, triggers the native file dialog via `<input type="file">`.
     * In Electron, uses the OS file dialog via `dialog.showOpenDialog()`.
     * @param prompt The prompt text to display while the picker is open
     * @param options Optional configuration for multiple selection, file type filter, and directory mode
     * @returns The selected file(s) with name, content, and metadata, or null if cancelled/aborted
     */
    readFile(
        prompt: string,
        options?: CliFilePickerOptions,
    ): Promise<CliFileResult | CliFileResult[] | null>;
}
```

### Backward Compatibility

All existing method signatures remain valid:

- `readSelect(prompt, options)` still works — `selectOptions` parameter is optional
- `readSelectInline(prompt, options)` still works — `selectOptions` parameter is optional
- `readMultiSelect(prompt, options)` still works — `selectOptions` parameter is optional
- `readLine(prompt)` still works — `options` parameter is optional
- `CliSelectOption` new fields (`description`, `group`, `disabled`) are all optional

The third parameter on `readSelect` changes from `onChange?: (value: string) => void` to `selectOptions?: CliSelectOptions`. Since the types are structurally incompatible (function vs object), any caller passing a bare function will get a compile-time error. This is an intentional breaking change — callers must migrate `onChange` into the options object. The migration is mechanical: `readSelect(p, opts, fn)` → `readSelect(p, opts, { onChange: fn })`.

## File Picker Host Abstraction

### ICliFilePickerProvider (packages/core)

```typescript
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

### Implementations

| Class | Package | Strategy |
|---|---|---|
| `BrowserFilePickerProvider` | `packages/core` | Creates hidden `<input type="file">`, triggers `click()`, reads via `FileReader` API. Sets `accept` for filters, `multiple` for multi-select, `webkitdirectory` for directories. `path` is always `undefined`. |
| `ElectronFilePickerProvider` | `packages/electron-cli` | Uses `window.electronCliApi.showOpenDialog()`. Extends the existing Electron bridge to support `multiple` and `directory` options. Returns full OS `path`. |
| `NoopFilePickerProvider` | `packages/core` | `isSupported: false`. `pickFiles()` and `pickDirectory()` resolve `null`. Used in SSR and test environments. |

### Registration

`CliInputReaderHost` gains an optional `filePickerProvider` property:

```typescript
export interface CliInputReaderHost {
    readonly activeInputRequest: ActiveInputRequest | null;
    setActiveInputRequest(request: ActiveInputRequest | null): void;
    writeToTerminal(text: string): void;
    getTerminalRows?(): number;
    getTerminalCols?(): number;             // NEW — needed for inline select overflow
    filePickerProvider?: ICliFilePickerProvider;  // NEW
}
```

`CliExecutionContext` sets the provider during initialization:
- If `window.electronCliApi` exists → `ElectronFilePickerProvider`
- Else if `document` exists → `BrowserFilePickerProvider`
- Else → `NoopFilePickerProvider`

## Visual Design

All inputs follow a consistent visual language:

### Prompt Line
```
? Prompt text: [input area]
```
- Cyan `?` prefix on all prompts
- Colon + space before input area

### Select Options (Vertical)
```
? Pick a framework: Type to filter...
    Angular
  ❯ React — Component-based UI library
    Vue — Progressive framework
    Svelte (disabled)
    ↑/↓ navigate · type to filter · enter to select · esc to cancel
```

- `❯` (U+276F) for the selection arrow, replaces `>`
- Highlighted option gets a subtle background tint via ANSI 256-color (blue on dark terminals)
- Descriptions rendered as dim italic text after the label
- Disabled options rendered fully dim with `(disabled)` suffix
- Help bar at bottom: dim text showing available keys, contextual to the input type

### Select Options — Group Headers
```
  ── SQL ──
  ❯ PostgreSQL
    MySQL
  ── NoSQL ──
    MongoDB
```

- Group headers rendered in purple/magenta dim text
- Not selectable — Up/Down arrows skip them
- Hidden when search filter excludes all children

### Select Options — Search Active
```
? Pick a framework: re│
  ❯ React — Component-based UI library
    Preact — Fast 3kb React alternative
    2 of 8 matches · backspace to clear filter
```

- Filter string shown after prompt, with cursor
- Matched substring highlighted in yellow within labels
- Help bar shows match count

### Multi-Select
```
? Select toppings: Type to filter...
  ❯ ◉ Cheese
    ○ Pepperoni
    ◉ Mushrooms
    2 selected · space to toggle · a to select all · enter to confirm
```

- `◉` (U+25C9) for checked, `○` (U+25CB) for unchecked — replaces `[x]`/`[ ]`
- Help bar shows selection count

### Inline Select — Overflow Handling
```
? Size: ◂  Small  [ Medium ]  Large  ▸
```

- `◂` (U+25C2) and `▸` (U+25B8) indicators when options overflow terminal width
- Only visible options rendered; scrolls as selection moves

### Validation Errors
```
? Enter email: user@│
  ✘ Must be a valid email address
```

- Red `✘` prefix on error line below input
- Error clears on next keystroke

### Date Input
```
? Start date (YYYY-MM-DD): 2026-02-30│
  ✘ Invalid date: February has 28 days
```

- Format hint shown in dim parentheses after prompt
- Calendar-aware validation (leap years, month lengths)

### File Picker
```
? Select config file (.json, .yaml): Opening file picker...
  ✔ config.json (2.4 KB)
```

- Accept filter shown in dim parentheses after prompt
- `Opening file picker...` in yellow while dialog is open
- `✔` in green with filename and size on success
- `(cancelled)` in dim on cancel

## Resize Handling

### Current Bug

`cli-execution-context.ts` line 353-358 bails out of `handleTerminalResize()` when `_activeInputRequest` is non-null. This means any resize during an active select/multi-select leaves rendering misaligned.

### Fix

Add optional `onResize` to `IInputMode`:

```typescript
export interface IInputMode {
    handleInput(data: string): Promise<void>;
    handleKeyEvent(event: KeyboardEvent): boolean;
    activate?(): void;
    deactivate?(): void;
    /** Called when the terminal is resized while this mode is active. */
    onResize?(cols: number, rows: number): void;
}
```

Per-mode resize behavior:

| Mode | On resize |
|---|---|
| `LineInputMode` | Redraw prompt + buffer |
| `PasswordInputMode` | Redraw prompt + masked buffer |
| `ConfirmInputMode` | Redraw prompt + buffer |
| `SelectInputMode` | Recalculate `maxVisible` from new `rows`, adjust `scrollOffset`, re-render option list |
| `InlineSelectInputMode` | Recalculate visible window from new `cols`, re-render |
| `MultiSelectInputMode` | Recalculate `maxVisible` from new `rows`, adjust `scrollOffset`, re-render |
| `NumberInputMode` | Redraw prompt + buffer |
| `DateInputMode` | Redraw prompt + buffer |
| `FileInputMode` | No-op (waiting for async dialog) |

In `CliExecutionContext.handleTerminalResize()`: Replace the early return when `_activeInputRequest` is set with a delegation to `this.currentMode?.onResize?.(cols, rows)`.

## Search/Filter Behavior

Applies to `SelectInputMode` and `MultiSelectInputMode` when `searchable: true`.

1. Printable keystrokes append to a filter string displayed after the prompt
2. Options are filtered by case-insensitive substring match against `label`
3. Matched portion highlighted in yellow (ANSI `\x1b[33m`) within the label
4. Selected index resets to first visible option on each filter change
5. Backspace removes last filter character; empty filter shows all options
6. Group headers hidden when all their children are filtered out
7. Disabled options remain in filtered results but are not selectable (skipped by arrow keys)
8. Help bar updates to show match count: `"N of M matches · backspace to clear filter"`
9. Enter confirms the currently highlighted option from the filtered list
10. Escape or Ctrl+C clears filter first if non-empty; second press aborts the input

When `searchable: false` (default): Printable keystrokes are ignored. Arrow keys only. This preserves backward compatibility.

## Test Strategy

### Unit Tests Per Mode

Each mode class gets its own spec file under `packages/cli/src/tests/modes/`:

| Test file | Key scenarios |
|---|---|
| `input-mode-base.spec.ts` | Ctrl+C abort, Escape abort, resolveAndPop cleanup |
| `line-input-mode.spec.ts` | Text entry, cursor nav (Left/Right), backspace mid-string, default value pre-fill, placeholder display, validation (error shown + re-prompt on Enter), multi-char paste |
| `password-input-mode.spec.ts` | Masking with `*`, backspace, arrow keys ignored, Enter resolve |
| `confirm-input-mode.spec.ts` | Accept y/n, reject other chars, default value on empty Enter |
| `select-input-mode.spec.ts` | Arrow nav, Enter resolve, scroll window, search/filter (type → filter → backspace → restore), group headers (skipped during nav), disabled options (skipped), default selection via value, onChange callback |
| `inline-select-input-mode.spec.ts` | Left/Right nav, Enter resolve, overflow truncation with `◂`/`▸`, resize recalculates visible window, onChange callback |
| `multi-select-input-mode.spec.ts` | Space toggle, Enter resolve, select all (`a` key), deselect all (second `a`), search/filter, scroll, onChange callback |
| `number-input-mode.spec.ts` | Digit entry, minus at position 0 only, cursor nav Left/Right (new), min/max validation errors, default on empty Enter |
| `date-input-mode.spec.ts` | Format validation (YYYY-MM-DD default, MM/DD/YYYY), invalid calendar dates (Feb 30, month 13), leap year handling, min/max range validation, default pre-fill |
| `file-input-mode.spec.ts` | Mock `ICliFilePickerProvider` — single file resolve, multiple files, directory mode, user cancel → null, accept filter passed through, Ctrl+C abort during async wait |

### Modified Tests

- `input-reader.spec.ts` — Add tests for `readDate` and `readFile` request creation, verify backward compat of existing calls
- `cli-test-harness.ts` — Add `readDate` and `readFile` to `createQueuedReader()`

### Deleted Tests

- `reader-mode.spec.ts` — Replaced entirely by per-mode spec files

### Backward Compatibility Tests

A dedicated spec (`backward-compat.spec.ts`) that calls the interface using the old-style signatures (no options objects) and verifies identical behavior to the current implementation.

## Migration Notes

### Breaking Change: readSelect/readSelectInline/readMultiSelect Third Parameter

The third parameter changes from a bare callback to an options object:

```typescript
// Before
readSelect(prompt, options, onChange)
readSelect(prompt, options)

// After
readSelect(prompt, options, { onChange })
readSelect(prompt, options)  // still works
```

All callers in the monorepo passing `onChange` must be updated. Callers not using the third parameter need no changes.

### ElectronCliApi Extension

`ElectronCliApi.showOpenDialog` in `packages/electron-cli/src/lib/types.ts` needs extended options:

```typescript
showOpenDialog(options?: {
    accept?: string;
    multiple?: boolean;    // NEW
    directory?: boolean;   // NEW
}): Promise<{ name: string; content: string; path: string; size: number; type: string }[] | null>;
```

The return type changes from a single result to an array. The preload script and main process handler must be updated accordingly.

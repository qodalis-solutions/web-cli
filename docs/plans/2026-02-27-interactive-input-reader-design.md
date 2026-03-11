# Interactive Input Reader Design

**Date:** 2026-02-27
**Status:** Approved

## Summary

Add interactive user input support to the Qodalis CLI framework via a `context.reader` API that provides `readLine`, `readPassword`, `readConfirm`, and `readSelect` methods. Uses an input mode switching approach where an active input request temporarily hijacks the terminal's `handleInput` flow.

## API

### `ICliInputReader` Interface (core)

```typescript
export interface ICliInputReader {
    readLine(prompt: string): Promise<string | null>;
    readPassword(prompt: string): Promise<string | null>;
    readConfirm(prompt: string, defaultValue?: boolean): Promise<boolean | null>;
    readSelect(prompt: string, options: CliSelectOption[]): Promise<string | null>;
}

export interface CliSelectOption {
    label: string;
    value: string;
}
```

### Usage in Command Processors

```typescript
async processCommand(command, context) {
    const name = await context.reader.readLine('Enter your name: ');
    const password = await context.reader.readPassword('Password: ');
    const confirm = await context.reader.readConfirm('Continue?');
    const choice = await context.reader.readSelect('Pick one:', [
        { label: 'Option A', value: 'a' },
        { label: 'Option B', value: 'b' },
    ]);
}
```

### Abort Behavior

All methods resolve with `null` on Ctrl+C or Escape. No exceptions thrown.

## Architecture: Input Mode Switching

### Active Input Request

When a reader method is called, it sets an `activeInputRequest` on the execution context:

```typescript
interface ActiveInputRequest {
    type: 'line' | 'password' | 'confirm' | 'select';
    promptText: string;
    resolve: (value: any) => void;
    buffer: string;
    cursorPosition: number;
    options?: CliSelectOption[];
    selectedIndex?: number;
}
```

### handleInput Interception

The existing `handleInput(data)` method gets an early guard:

```typescript
private async handleInput(data: string): Promise<void> {
    if (this.isProgressRunning()) return;
    if (this.activeInputRequest) {
        this.handleReaderInput(data);
        return;
    }
    // ... existing logic ...
}
```

### Ctrl+C / Escape Integration

The `attachCustomKeyEventHandler` checks for active input and resolves with `null`:

```typescript
if (this.activeInputRequest) {
    this.activeInputRequest.resolve(null);
    this.activeInputRequest = null;
    this.terminal.writeln('');
    return false;
}
```

## Per-Type Input Handling

| Key | readLine | readPassword | readConfirm | readSelect |
|-----|----------|-------------|-------------|------------|
| Enter | resolve with buffer | resolve with buffer | resolve based on y/n or default | resolve with selected value |
| Backspace | delete char, redraw | delete char, redraw `*`s | delete char, redraw | ignored |
| Arrow Up/Down | ignored | ignored | ignored | move selection, redraw |
| Regular char | append, echo | append, echo `*` | only y/n/Y/N | ignored |

## Visual Rendering

- **readLine:** `Enter your name: user input█`
- **readPassword:** `Password: ****█`
- **readConfirm:** `Continue? (y/N): █` — default shown in uppercase
- **readSelect:** Arrow-key navigable list:
  ```
  Pick one:
    > Option A
      Option B
      Option C
  ```

## File Locations

| What | Where |
|------|-------|
| `ICliInputReader` + `CliSelectOption` | `projects/core/src/lib/interfaces/input-reader.ts` |
| Export from core barrel | `projects/core/src/lib/interfaces/index.ts` |
| `reader` on `ICliExecutionContext` | `projects/core/src/lib/interfaces/execution-context.ts` |
| `CliInputReader` class | `projects/cli/src/lib/services/cli-input-reader.ts` |
| `handleReaderInput()` + `activeInputRequest` | `projects/cli/src/lib/context/cli-execution-context.ts` |

## Edge Cases

- **Nested reads:** Sequential awaits work naturally. Concurrent reads (missing await) reject immediately with an error.
- **Empty Enter:** `readLine`/`readPassword` resolve with `''`. `readConfirm` resolves with `defaultValue` (or `false`). `readSelect` confirms current selection.
- **Paste (Ctrl+V):** Works for `readLine` (full text appended) and `readPassword` (appended, shown as `*`). Ignored for `readConfirm` and `readSelect`.
- **Progress bars:** `isProgressRunning()` check runs before the reader check, so no conflict.
- **History keys:** Arrow Up/Down ignored during all reader modes except `readSelect` where they navigate options.

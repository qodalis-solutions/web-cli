# Interactive Input Reader Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `context.reader` API to the Qodalis CLI framework providing `readLine`, `readPassword`, `readConfirm`, and `readSelect` interactive input methods.

**Architecture:** Input mode switching — when a reader method is called, it sets an `activeInputRequest` flag on the execution context. The existing `handleInput` method checks this flag first and routes keystrokes to reader-specific handling instead of the normal command pipeline. Ctrl+C/Escape resolve with `null`.

**Tech Stack:** TypeScript, xterm.js, Angular, Jasmine/Karma

**Design doc:** `docs/plans/2026-02-27-interactive-input-reader-design.md`

---

### Task 1: Create `ICliInputReader` interface and `CliSelectOption` model in core

**Files:**
- Create: `projects/core/src/lib/interfaces/input-reader.ts`
- Modify: `projects/core/src/lib/interfaces/index.ts`
- Modify: `projects/core/src/lib/interfaces/execution-context.ts`

**Step 1: Create the interface file**

Create `projects/core/src/lib/interfaces/input-reader.ts`:

```typescript
/**
 * Represents an option for the readSelect prompt.
 */
export interface CliSelectOption {
    /** Display text shown to the user */
    label: string;
    /** Value returned when this option is selected */
    value: string;
}

/**
 * Provides interactive input reading from the terminal.
 * All methods resolve with `null` when the user aborts (Ctrl+C or Escape).
 */
export interface ICliInputReader {
    /**
     * Prompt the user for a line of text input.
     * @param prompt The prompt text to display (e.g. "Enter your name: ")
     * @returns The entered text, empty string if Enter pressed with no input, or null if aborted
     */
    readLine(prompt: string): Promise<string | null>;

    /**
     * Prompt the user for password input. Characters are masked with asterisks.
     * @param prompt The prompt text to display (e.g. "Password: ")
     * @returns The entered password, empty string if Enter pressed with no input, or null if aborted
     */
    readPassword(prompt: string): Promise<string | null>;

    /**
     * Prompt the user for a yes/no confirmation.
     * @param prompt The prompt text to display (e.g. "Continue?")
     * @param defaultValue The default value when Enter is pressed without input (defaults to false)
     * @returns true for yes, false for no, defaultValue on empty Enter, or null if aborted
     */
    readConfirm(prompt: string, defaultValue?: boolean): Promise<boolean | null>;

    /**
     * Prompt the user to select from a list of options using arrow keys.
     * @param prompt The prompt text to display (e.g. "Pick one:")
     * @param options The list of options to choose from
     * @returns The value of the selected option, or null if aborted
     */
    readSelect(prompt: string, options: CliSelectOption[]): Promise<string | null>;
}
```

**Step 2: Export from the interfaces barrel**

In `projects/core/src/lib/interfaces/index.ts`, add at the bottom before the existing re-exports:

```typescript
export * from './input-reader';
```

**Step 3: Add `reader` to `ICliExecutionContext`**

In `projects/core/src/lib/interfaces/execution-context.ts`, add the import and the property.

Add to the imports at the top:

```typescript
import { ICliInputReader } from './input-reader';
```

Add this property to the `ICliExecutionContext` interface (after the `writer` property, around line 55):

```typescript
    /**
     * The reader to use for interactive input prompts (text, password, confirm, select)
     */
    reader: ICliInputReader;
```

**Step 4: Build core to verify**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "build core"`

Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add projects/core/src/lib/interfaces/input-reader.ts projects/core/src/lib/interfaces/index.ts projects/core/src/lib/interfaces/execution-context.ts
git commit -m "feat(core): add ICliInputReader interface and CliSelectOption model"
```

---

### Task 2: Create `CliInputReader` implementation class

**Files:**
- Create: `projects/cli/src/lib/services/cli-input-reader.ts`
- Modify: `projects/cli/src/lib/services/index.ts`

**Step 1: Create the `ActiveInputRequest` type and `CliInputReader` class**

Create `projects/cli/src/lib/services/cli-input-reader.ts`:

```typescript
import { ICliInputReader, CliSelectOption } from '@qodalis/cli-core';

export type ActiveInputRequestType = 'line' | 'password' | 'confirm' | 'select';

export interface ActiveInputRequest {
    type: ActiveInputRequestType;
    promptText: string;
    resolve: (value: any) => void;
    buffer: string;
    cursorPosition: number;
    defaultValue?: boolean;
    options?: CliSelectOption[];
    selectedIndex?: number;
}

export interface CliInputReaderHost {
    readonly activeInputRequest: ActiveInputRequest | null;
    setActiveInputRequest(request: ActiveInputRequest | null): void;
    writeToTerminal(text: string): void;
}

export class CliInputReader implements ICliInputReader {
    constructor(private readonly host: CliInputReaderHost) {}

    readLine(prompt: string): Promise<string | null> {
        return this.createInputRequest('line', prompt);
    }

    readPassword(prompt: string): Promise<string | null> {
        return this.createInputRequest('password', prompt);
    }

    readConfirm(prompt: string, defaultValue: boolean = false): Promise<boolean | null> {
        const hint = defaultValue ? '(Y/n)' : '(y/N)';
        const displayPrompt = `${prompt} ${hint}: `;

        return new Promise<boolean | null>((resolve) => {
            if (this.host.activeInputRequest) {
                throw new Error('Another input request is already active');
            }

            this.host.writeToTerminal(displayPrompt);

            this.host.setActiveInputRequest({
                type: 'confirm',
                promptText: displayPrompt,
                resolve,
                buffer: '',
                cursorPosition: 0,
                defaultValue,
            });
        });
    }

    readSelect(prompt: string, options: CliSelectOption[]): Promise<string | null> {
        if (!options || options.length === 0) {
            return Promise.reject(new Error('readSelect requires at least one option'));
        }

        return new Promise<string | null>((resolve) => {
            if (this.host.activeInputRequest) {
                throw new Error('Another input request is already active');
            }

            // Write prompt and render options
            this.host.writeToTerminal(prompt + '\r\n');
            this.renderSelectOptions(options, 0);

            this.host.setActiveInputRequest({
                type: 'select',
                promptText: prompt,
                resolve,
                buffer: '',
                cursorPosition: 0,
                options,
                selectedIndex: 0,
            });
        });
    }

    renderSelectOptions(options: CliSelectOption[], selectedIndex: number): void {
        for (let i = 0; i < options.length; i++) {
            const prefix = i === selectedIndex ? '  \x1b[36m> ' : '    ';
            const suffix = i === selectedIndex ? '\x1b[0m' : '';
            this.host.writeToTerminal(`${prefix}${options[i].label}${suffix}\r\n`);
        }
    }

    private createInputRequest(type: 'line' | 'password', prompt: string): Promise<string | null> {
        return new Promise<string | null>((resolve) => {
            if (this.host.activeInputRequest) {
                throw new Error('Another input request is already active');
            }

            this.host.writeToTerminal(prompt);

            this.host.setActiveInputRequest({
                type,
                promptText: prompt,
                resolve,
                buffer: '',
                cursorPosition: 0,
            });
        });
    }
}
```

**Step 2: Export from the services barrel**

In `projects/cli/src/lib/services/index.ts`, add:

```typescript
export { CliInputReader, ActiveInputRequest, ActiveInputRequestType, CliInputReaderHost } from './cli-input-reader';
```

**Step 3: Commit**

```bash
git add projects/cli/src/lib/services/cli-input-reader.ts projects/cli/src/lib/services/index.ts
git commit -m "feat(cli): add CliInputReader class with ActiveInputRequest types"
```

---

### Task 3: Wire `activeInputRequest` and `handleReaderInput` into `CliExecutionContext`

**Files:**
- Modify: `projects/cli/src/lib/context/cli-execution-context.ts`

This is the core integration task. The execution context needs to:
1. Implement `CliInputReaderHost`
2. Create the `CliInputReader` instance
3. Expose `activeInputRequest`
4. Add `handleReaderInput()` method
5. Add early guard in `handleInput()`
6. Add Ctrl+C/Escape handling for active input requests

**Step 1: Add imports**

At the top of `projects/cli/src/lib/context/cli-execution-context.ts`, add to the imports from the local services:

```typescript
import { CliInputReader, ActiveInputRequest, CliInputReaderHost } from '../services/cli-input-reader';
```

Add `ICliInputReader` to the `@qodalis/cli-core` import:

```typescript
import {
    ICliExecutionContext,
    ICliTerminalWriter,
    // ... existing imports ...
    ICliInputReader,
} from '@qodalis/cli-core';
```

**Step 2: Add `CliInputReaderHost` implementation to the class**

Change the class declaration to implement the host interface:

```typescript
export class CliExecutionContext implements ICliExecutionContext, CliInputReaderHost {
```

Add these properties after the existing `private _currentLine` property (around line 70):

```typescript
    public readonly reader: ICliInputReader;

    private _activeInputRequest: ActiveInputRequest | null = null;

    public get activeInputRequest(): ActiveInputRequest | null {
        return this._activeInputRequest;
    }

    public setActiveInputRequest(request: ActiveInputRequest | null): void {
        this._activeInputRequest = request;
    }

    public writeToTerminal(text: string): void {
        this.terminal.write(text);
    }
```

**Step 3: Initialize reader in constructor**

In the constructor, after `this.process = new CliExecutionProcess(this);` (around line 114), add:

```typescript
        this.reader = new CliInputReader(this);
```

**Step 4: Add Ctrl+C handling for active input requests**

In `initializeTerminalListeners()`, inside the `attachCustomKeyEventHandler` callback, at the very top of the `if (event.type === 'keydown')` block (before the existing Ctrl+C check), add:

```typescript
                // Handle abort for active input requests
                if (this._activeInputRequest) {
                    if (event.code === 'KeyC' && event.ctrlKey) {
                        this._activeInputRequest.resolve(null);
                        this._activeInputRequest = null;
                        this.terminal.writeln('');
                        return false;
                    }

                    if (event.code === 'Escape') {
                        this._activeInputRequest.resolve(null);
                        this._activeInputRequest = null;
                        this.terminal.writeln('');
                        return false;
                    }

                    // Block all other custom key handlers during input mode
                    return true;
                }
```

**Step 5: Add early guard in `handleInput`**

In the `handleInput` method, right after the `isProgressRunning()` check (line 340-342), add:

```typescript
        if (this._activeInputRequest) {
            this.handleReaderInput(data);
            return;
        }
```

**Step 6: Add `handleReaderInput` method**

Add this new method after the `handleInput` method:

```typescript
    private handleReaderInput(data: string): void {
        const request = this._activeInputRequest!;

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

    private handleLineInput(request: ActiveInputRequest, data: string): void {
        if (data === '\r') {
            this.terminal.write('\r\n');
            const value = request.buffer;
            this._activeInputRequest = null;
            request.resolve(value);
        } else if (data === '\u007F') {
            // Backspace
            if (request.cursorPosition > 0) {
                request.buffer =
                    request.buffer.slice(0, request.cursorPosition - 1) +
                    request.buffer.slice(request.cursorPosition);
                request.cursorPosition--;
                this.redrawReaderLine(request, request.buffer);
            }
        } else if (data === '\u001B[D') {
            // Arrow left
            if (request.cursorPosition > 0) {
                request.cursorPosition--;
                this.terminal.write(data);
            }
        } else if (data === '\u001B[C') {
            // Arrow right
            if (request.cursorPosition < request.buffer.length) {
                request.cursorPosition++;
                this.terminal.write(data);
            }
        } else if (data.startsWith('\u001B')) {
            // Ignore other escape sequences (arrow up/down, etc.)
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
            this.terminal.write('\r\n');
            const value = request.buffer;
            this._activeInputRequest = null;
            request.resolve(value);
        } else if (data === '\u007F') {
            // Backspace
            if (request.cursorPosition > 0) {
                request.buffer =
                    request.buffer.slice(0, request.cursorPosition - 1) +
                    request.buffer.slice(request.cursorPosition);
                request.cursorPosition--;
                this.redrawReaderLine(request, '*'.repeat(request.buffer.length));
            }
        } else if (data.startsWith('\u001B')) {
            // Ignore all escape sequences for password (no cursor movement)
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
            this.terminal.write('\r\n');
            this._activeInputRequest = null;
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
            // Ignore all other characters
        }
    }

    private handleSelectInput(request: ActiveInputRequest, data: string): void {
        const options = request.options!;
        let selectedIndex = request.selectedIndex!;

        if (data === '\r') {
            this.terminal.write('\r\n');
            this._activeInputRequest = null;
            request.resolve(options[selectedIndex].value);
        } else if (data === '\u001B[A') {
            // Arrow up
            if (selectedIndex > 0) {
                request.selectedIndex = selectedIndex - 1;
                this.redrawSelectOptions(request);
            }
        } else if (data === '\u001B[B') {
            // Arrow down
            if (selectedIndex < options.length - 1) {
                request.selectedIndex = selectedIndex + 1;
                this.redrawSelectOptions(request);
            }
        }
        // Ignore all other input
    }

    private redrawReaderLine(request: ActiveInputRequest, displayText: string): void {
        // Clear line and rewrite prompt + display text
        this.terminal.write('\x1b[2K\r');
        this.terminal.write(request.promptText + displayText);

        // Reposition cursor if not at end
        const cursorOffset = request.buffer.length - request.cursorPosition;
        if (cursorOffset > 0) {
            this.terminal.write(`\x1b[${cursorOffset}D`);
        }
    }

    private redrawSelectOptions(request: ActiveInputRequest): void {
        const options = request.options!;
        const selectedIndex = request.selectedIndex!;

        // Move cursor up to start of options list
        if (options.length > 0) {
            this.terminal.write(`\x1b[${options.length}A`);
        }

        // Redraw all options
        for (let i = 0; i < options.length; i++) {
            this.terminal.write('\x1b[2K\r');
            const prefix = i === selectedIndex ? '  \x1b[36m> ' : '    ';
            const suffix = i === selectedIndex ? '\x1b[0m' : '';
            this.terminal.write(`${prefix}${options[i].label}${suffix}`);
            if (i < options.length - 1) {
                this.terminal.write('\r\n');
            }
        }
    }
```

**Step 7: Build cli to verify**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "build all"`

Expected: Build succeeds with no errors. There may be compilation warnings from plugins that now see the `reader` property on the context but don't use it — that's fine.

**Step 8: Commit**

```bash
git add projects/cli/src/lib/context/cli-execution-context.ts
git commit -m "feat(cli): wire input reader into execution context with mode switching"
```

---

### Task 4: Write tests for `CliInputReader`

**Files:**
- Create: `projects/cli/src/tests/input-reader.spec.ts`

**Step 1: Write the test file**

Create `projects/cli/src/tests/input-reader.spec.ts`:

```typescript
import { CliInputReader, ActiveInputRequest, CliInputReaderHost } from '../lib/services/cli-input-reader';

class MockHost implements CliInputReaderHost {
    activeInputRequest: ActiveInputRequest | null = null;
    writtenText: string[] = [];

    get activeRequest(): ActiveInputRequest | null {
        return this.activeInputRequest;
    }

    setActiveInputRequest(request: ActiveInputRequest | null): void {
        this.activeInputRequest = request;
    }

    writeToTerminal(text: string): void {
        this.writtenText.push(text);
    }

    reset(): void {
        this.activeInputRequest = null;
        this.writtenText = [];
    }
}

describe('CliInputReader', () => {
    let host: MockHost;
    let reader: CliInputReader;

    beforeEach(() => {
        host = new MockHost();
        reader = new CliInputReader(host);
    });

    describe('readLine', () => {
        it('should set an active input request of type line', () => {
            reader.readLine('Name: ');
            expect(host.activeInputRequest).not.toBeNull();
            expect(host.activeInputRequest!.type).toBe('line');
        });

        it('should write the prompt text to the terminal', () => {
            reader.readLine('Enter name: ');
            expect(host.writtenText).toContain('Enter name: ');
        });

        it('should initialize buffer as empty string', () => {
            reader.readLine('Name: ');
            expect(host.activeInputRequest!.buffer).toBe('');
            expect(host.activeInputRequest!.cursorPosition).toBe(0);
        });

        it('should reject if another request is already active', async () => {
            reader.readLine('First: ');
            expect(() => reader.readLine('Second: ')).toThrowError('Another input request is already active');
        });

        it('should resolve with value when resolve is called', async () => {
            const promise = reader.readLine('Name: ');
            host.activeInputRequest!.resolve('test');
            const result = await promise;
            expect(result).toBe('test');
        });

        it('should resolve with null when resolve is called with null', async () => {
            const promise = reader.readLine('Name: ');
            host.activeInputRequest!.resolve(null);
            const result = await promise;
            expect(result).toBeNull();
        });
    });

    describe('readPassword', () => {
        it('should set an active input request of type password', () => {
            reader.readPassword('Password: ');
            expect(host.activeInputRequest).not.toBeNull();
            expect(host.activeInputRequest!.type).toBe('password');
        });

        it('should write the prompt text to the terminal', () => {
            reader.readPassword('Password: ');
            expect(host.writtenText).toContain('Password: ');
        });
    });

    describe('readConfirm', () => {
        it('should set an active input request of type confirm', () => {
            reader.readConfirm('Continue?');
            expect(host.activeInputRequest).not.toBeNull();
            expect(host.activeInputRequest!.type).toBe('confirm');
        });

        it('should display (y/N) hint when default is false', () => {
            reader.readConfirm('Continue?', false);
            expect(host.writtenText[0]).toContain('(y/N)');
        });

        it('should display (Y/n) hint when default is true', () => {
            reader.readConfirm('Continue?', true);
            expect(host.writtenText[0]).toContain('(Y/n)');
        });

        it('should store defaultValue on the request', () => {
            reader.readConfirm('Continue?', true);
            expect(host.activeInputRequest!.defaultValue).toBe(true);
        });

        it('should default to false when no defaultValue provided', () => {
            reader.readConfirm('Continue?');
            expect(host.activeInputRequest!.defaultValue).toBe(false);
        });
    });

    describe('readSelect', () => {
        const options = [
            { label: 'Option A', value: 'a' },
            { label: 'Option B', value: 'b' },
            { label: 'Option C', value: 'c' },
        ];

        it('should set an active input request of type select', () => {
            reader.readSelect('Pick one:', options);
            expect(host.activeInputRequest).not.toBeNull();
            expect(host.activeInputRequest!.type).toBe('select');
        });

        it('should store options and initialize selectedIndex to 0', () => {
            reader.readSelect('Pick one:', options);
            expect(host.activeInputRequest!.options).toBe(options);
            expect(host.activeInputRequest!.selectedIndex).toBe(0);
        });

        it('should reject with error for empty options', async () => {
            await expectAsync(reader.readSelect('Pick:', [])).toBeRejectedWithError('readSelect requires at least one option');
        });

        it('should write the prompt and render options', () => {
            reader.readSelect('Pick one:', options);
            expect(host.writtenText[0]).toContain('Pick one:');
            // Options are rendered after prompt
            expect(host.writtenText.length).toBeGreaterThan(1);
        });
    });
});
```

**Step 2: Run the tests**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npx ng test cli --watch=false --browsers=ChromeHeadless`

Expected: All tests pass.

**Step 3: Commit**

```bash
git add projects/cli/src/tests/input-reader.spec.ts
git commit -m "test(cli): add unit tests for CliInputReader"
```

---

### Task 5: Manual integration test — add a demo command

**Files:**
- Modify: a command processor in the demo or an existing plugin to exercise the reader

Pick the simplest existing processor to add a quick test. The password-generator plugin is a good candidate.

**Step 1: Find and modify a processor to use `context.reader`**

In `projects/demo/` or any plugin, add a temporary test command or modify an existing one. For example, create a minimal test in the demo app's boot flow, or add a `--interactive` flag to an existing command that triggers prompts.

The simplest approach: add a small test in the demo app to validate all 4 methods work end-to-end. This can be a standalone processor registered in the demo module.

**Step 2: Run the demo**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "start demo"`

Test manually:
1. Type the test command → verify `readLine` shows prompt, accepts text, Enter resolves
2. Verify `readPassword` shows `*` per character
3. Verify `readConfirm` shows `(y/N)` hint, accepts only y/n
4. Verify `readSelect` renders options list, arrow keys navigate, Enter selects
5. Verify Ctrl+C on any prompt returns to normal mode

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(demo): add interactive input demo command for manual testing"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | `ICliInputReader` interface + `CliSelectOption` in core, add `reader` to context interface | `core/interfaces/input-reader.ts`, `core/interfaces/index.ts`, `core/interfaces/execution-context.ts` |
| 2 | `CliInputReader` class + `ActiveInputRequest` types | `cli/services/cli-input-reader.ts`, `cli/services/index.ts` |
| 3 | Wire into `CliExecutionContext`: host interface, `handleReaderInput`, Ctrl+C/Escape, `handleInput` guard | `cli/context/cli-execution-context.ts` |
| 4 | Unit tests for `CliInputReader` | `cli/tests/input-reader.spec.ts` |
| 5 | Manual integration test via demo command | demo processor file |

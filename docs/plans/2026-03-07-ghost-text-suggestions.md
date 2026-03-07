# Ghost-Text Inline Suggestions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show zsh-autosuggestions-style ghost text in the terminal as the user types — a dim completion hint that accepts with the right-arrow key.

**Architecture:** All changes are in `packages/cli/src/lib/input/command-line-mode.ts`. After each character typed, the completion engine is queried for the best single completion. If one exists, it is rendered in dim gray after the cursor. Pressing right-arrow (or End) while ghost text is visible and cursor is at end-of-buffer accepts it. Any other input clears the ghost.

**Tech Stack:** TypeScript, xterm.js ANSI escape codes, existing CliCompletionEngine

---

### Task 1: Add ghost-text state to CommandLineMode

**Files:**
- Modify: `packages/cli/src/lib/input/command-line-mode.ts:39-45`

**Step 1: Add private fields for ghost text state**

Inside `CommandLineMode` class, after the existing private fields (line 42-43), add:

```typescript
private ghostText = '';
private ghostDebounceTimer: ReturnType<typeof setTimeout> | null = null;
```

**Step 2: Commit**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
git add packages/cli/src/lib/input/command-line-mode.ts
git commit -m "feat(cli): add ghost-text state fields to CommandLineMode"
```

---

### Task 2: Add ghost-text rendering to refreshLine

**Files:**
- Modify: `packages/cli/src/lib/input/command-line-mode.ts:283-294`

**Step 1: Extract refreshLine into a method that also renders ghost text**

Replace the `refreshLine` method (currently lines 283-294) with:

```typescript
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
    // Dim gray ghost text, then reset and move cursor back left
    const ghost = this.ghostText;
    this.host.terminal.write(
        `\x1b[2m\x1b[38;5;240m${ghost}\x1b[0m\x1b[${ghost.length}D`,
    );
}
```

**Step 2: Commit**

```bash
git add packages/cli/src/lib/input/command-line-mode.ts
git commit -m "feat(cli): render ghost text after cursor in dim color"
```

---

### Task 3: Add ghost-text computation (debounced)

**Files:**
- Modify: `packages/cli/src/lib/input/command-line-mode.ts:167-171`

**Step 1: Update handleInputText to trigger ghost text after insert**

Replace the `handleInputText` method (lines 167-171):

```typescript
private handleInputText(text: string): void {
    text = text.replace(/[\r\n\t]+/g, '');
    this.clearGhostText();
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
```

**Step 2: Also clear ghost text in handleBackspace and history navigation**

In `handleBackspace` (line 173), add `this.clearGhostText();` as the first line.
In `showPreviousCommand` (line 251), add `this.clearGhostText();` as the first line.
In `showNextCommand` (line 258), add `this.clearGhostText();` as the first line.

**Step 3: Clear ghost text when Tab is pressed**

In `handleInput` where Tab is detected (line 56-59), add `this.clearGhostText();` before the return.

**Step 4: Commit**

```bash
git add packages/cli/src/lib/input/command-line-mode.ts
git commit -m "feat(cli): compute and display ghost text suggestions after typing"
```

---

### Task 4: Add completeSingle to CliCompletionEngine

**Files:**
- Modify: `packages/cli/src/lib/completion/cli-completion-engine.ts`

**Step 1: Add completeSingle method**

At the end of the `CliCompletionEngine` class, add:

```typescript
/**
 * Return the single best completion string for ghost-text display.
 * Returns null if there is no clear best match or multiple candidates.
 */
async completeSingle(input: string, cursor: number): Promise<string | null> {
    const candidates = await this.gatherCandidates(input, cursor);
    if (candidates.length !== 1) return null;
    const token = this.getTokenAtCursor(input, cursor);
    const match = candidates[0];
    if (!match.startsWith(token)) return null;
    return input.slice(0, cursor - token.length) + match;
}
```

You need to extract the candidate-gathering logic from `complete()` into `gatherCandidates()`. Look at the existing `complete()` method and extract the part that collects candidates from all providers into a private `gatherCandidates(input, cursor): Promise<string[]>` method. Also extract `getTokenAtCursor(input, cursor): string` if not already present.

**Step 2: Run existing completion tests to verify no regressions**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
npx nx test cli --testFile=src/tests/completion.spec.ts
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

Expected: all existing tests pass.

**Step 3: Commit**

```bash
git add packages/cli/src/lib/completion/cli-completion-engine.ts
git commit -m "feat(cli): add completeSingle to CliCompletionEngine for ghost text"
```

---

### Task 5: Accept ghost text with right-arrow key

**Files:**
- Modify: `packages/cli/src/lib/input/command-line-mode.ts:97-101`

**Step 1: Intercept right-arrow key when ghost text is active**

In `handleInput`, replace the right-arrow handling (around line 97-101):

```typescript
} else if (data === '\u001B[C') {
    if (this.ghostText && this.host.lineBuffer.cursorPosition === this.host.lineBuffer.text.length) {
        // Accept ghost text
        this.host.lineBuffer.insert(this.ghostText);
        this.ghostText = '';
        this.refreshLine();
    } else if (this.host.lineBuffer.cursorPosition < this.host.lineBuffer.text.length) {
        this.host.lineBuffer.moveCursorRight();
        this.host.terminal.write(data);
    }
}
```

**Step 2: Also clear ghost text on Enter**

In the `'\r'` (Enter) handler, add `this.clearGhostText();` before the `terminal.write('\r\n')`.

**Step 3: Build and manually test**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
pnpm run build:cli
```

Start the Angular demo, type `the` — you should see `me` appear dimmed if `theme` is the only match. Press right arrow to accept.

**Step 4: Commit**

```bash
git add packages/cli/src/lib/input/command-line-mode.ts
git commit -m "feat(cli): accept ghost text suggestion with right-arrow key"
```

---

### Task 6: Write unit tests for ghost-text behavior

**Files:**
- Create: `packages/cli/src/tests/ghost-text.spec.ts`

**Step 1: Write failing tests**

```typescript
import { CliCompletionEngine } from '../lib/completion/cli-completion-engine';
import { CliCommandCompletionProvider } from '../lib/completion/cli-command-completion-provider';
import { CliCommandProcessorRegistry } from '../lib/registry/cli-command-processor-registry';

describe('CliCompletionEngine.completeSingle', () => {
    let engine: CliCompletionEngine;

    beforeEach(() => {
        const registry = new CliCommandProcessorRegistry();
        // Register a fake processor
        registry.register({
            command: 'theme',
            description: 'test',
            processCommand: async () => {},
        });
        engine = new CliCompletionEngine();
        engine.setProviders([new CliCommandCompletionProvider(registry)]);
    });

    it('returns null when input is empty', async () => {
        const result = await engine.completeSingle('', 0);
        expect(result).toBeNull();
    });

    it('returns null when multiple candidates exist', async () => {
        // 'th' might match 'theme' and 'time' etc
        const result = await engine.completeSingle('t', 1);
        // Multiple matches → null
        expect(result).toBeNull();
    });

    it('returns full command when single match', async () => {
        const result = await engine.completeSingle('them', 4);
        expect(result).toBe('theme');
    });

    it('returns null when no match', async () => {
        const result = await engine.completeSingle('zzz', 3);
        expect(result).toBeNull();
    });
});
```

**Step 2: Run tests**

```bash
npx nx test cli
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

Expected: all tests pass.

**Step 3: Commit**

```bash
git add packages/cli/src/tests/ghost-text.spec.ts
git commit -m "test(cli): add unit tests for ghost-text completeSingle"
```

# Diff Visualizer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a standalone `diff` built-in command that shows colored line-by-line differences between two text inputs — either piped or passed as inline arguments.

**Architecture:** New processor in `packages/cli/src/lib/processors/cli-diff-command-processor.ts`. Implements a simple LCS-based line diff algorithm inline (no external deps). Output uses green `+` for added lines, red `-` for removed, and dim for context lines. Accepts two inputs: pipe provides the first, `--b` parameter provides the second, or both can be provided inline.

**Tech Stack:** TypeScript, ANSI colors, simple LCS diff algorithm

---

### Task 1: Write failing tests

**Files:**
- Create: `packages/cli/src/tests/diff.spec.ts`

```typescript
import { computeDiff, DiffLine } from '../lib/processors/diff-utils';

describe('computeDiff', () => {
    it('returns empty array for identical inputs', () => {
        const result = computeDiff('hello\nworld', 'hello\nworld');
        expect(result.every((l) => l.type === 'same')).toBeTrue();
    });

    it('marks added lines with type "add"', () => {
        const result = computeDiff('line1', 'line1\nline2');
        expect(result.some((l) => l.type === 'add' && l.text === 'line2')).toBeTrue();
    });

    it('marks removed lines with type "remove"', () => {
        const result = computeDiff('line1\nline2', 'line1');
        expect(result.some((l) => l.type === 'remove' && l.text === 'line2')).toBeTrue();
    });

    it('handles completely different strings', () => {
        const result = computeDiff('aaa', 'bbb');
        expect(result.some((l) => l.type === 'remove')).toBeTrue();
        expect(result.some((l) => l.type === 'add')).toBeTrue();
    });

    it('handles empty left side (all additions)', () => {
        const result = computeDiff('', 'new line');
        expect(result.every((l) => l.type === 'add')).toBeTrue();
    });

    it('handles empty right side (all removals)', () => {
        const result = computeDiff('old line', '');
        expect(result.every((l) => l.type === 'remove')).toBeTrue();
    });
});
```

Run to verify failure:
```bash
cd /home/nicolae/work/cli-workspace/web-cli
npx nx test cli --testFile=src/tests/diff.spec.ts
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

---

### Task 2: Implement the diff algorithm

**Files:**
- Create: `packages/cli/src/lib/processors/diff-utils.ts`

```typescript
export type DiffType = 'same' | 'add' | 'remove';

export interface DiffLine {
    type: DiffType;
    text: string;
}

/**
 * Compute line-by-line diff using Myers diff algorithm (simplified LCS).
 */
export function computeDiff(left: string, right: string): DiffLine[] {
    const a = left === '' ? [] : left.split('\n');
    const b = right === '' ? [] : right.split('\n');

    // Build LCS table
    const m = a.length;
    const n = b.length;
    const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = m - 1; i >= 0; i--) {
        for (let j = n - 1; j >= 0; j--) {
            if (a[i] === b[j]) {
                lcs[i][j] = 1 + lcs[i + 1][j + 1];
            } else {
                lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
            }
        }
    }

    // Trace back through LCS table
    const result: DiffLine[] = [];
    let i = 0;
    let j = 0;

    while (i < m && j < n) {
        if (a[i] === b[j]) {
            result.push({ type: 'same', text: a[i] });
            i++;
            j++;
        } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
            result.push({ type: 'remove', text: a[i] });
            i++;
        } else {
            result.push({ type: 'add', text: b[j] });
            j++;
        }
    }

    while (i < m) { result.push({ type: 'remove', text: a[i++] }); }
    while (j < n) { result.push({ type: 'add', text: b[j++] }); }

    return result;
}

/**
 * Format diff lines with ANSI colors and +/- prefixes.
 * Context lines use a dim color; only show contextLines lines around changes.
 */
export function formatDiff(lines: DiffLine[], contextLines = 3): string[] {
    const output: string[] = [];
    const changes = new Set<number>();
    lines.forEach((l, i) => { if (l.type !== 'same') changes.add(i); });

    const visible = new Set<number>();
    for (const idx of changes) {
        for (let k = Math.max(0, idx - contextLines); k <= Math.min(lines.length - 1, idx + contextLines); k++) {
            visible.add(k);
        }
    }

    let lastVisible = -1;
    for (let i = 0; i < lines.length; i++) {
        if (!visible.has(i)) continue;
        if (lastVisible !== -1 && i > lastVisible + 1) {
            output.push('\x1b[2m...\x1b[0m');
        }
        const { type, text } = lines[i];
        if (type === 'add') {
            output.push(`\x1b[32m+ ${text}\x1b[0m`);
        } else if (type === 'remove') {
            output.push(`\x1b[31m- ${text}\x1b[0m`);
        } else {
            output.push(`\x1b[2m  ${text}\x1b[0m`);
        }
        lastVisible = i;
    }

    return output;
}
```

---

### Task 3: Implement the diff command processor

**Files:**
- Create: `packages/cli/src/lib/processors/cli-diff-command-processor.ts`

```typescript
import {
    ICliCommandProcessor, ICliExecutionContext, CliProcessCommand,
    ICliCommandAuthor, CliProcessorMetadata, CliIcon,
    DefaultLibraryAuthor, ICliCommandParameterDescriptor,
} from '@qodalis/cli-core';
import { computeDiff, formatDiff } from './diff-utils';

export class CliDiffCommandProcessor implements ICliCommandProcessor {
    command = 'diff';
    description = 'Show colored diff between two text inputs';
    author: ICliCommandAuthor = DefaultLibraryAuthor;
    metadata: CliProcessorMetadata = { icon: CliIcon.Compare, module: 'system' };

    parameters: ICliCommandParameterDescriptor[] = [
        {
            name: 'b',
            description: 'Second text to compare (first comes from pipe or --a)',
            required: false,
            type: 'string',
        },
        {
            name: 'a',
            description: 'First text (alternative to pipe)',
            required: false,
            type: 'string',
        },
        {
            name: 'context',
            description: 'Number of context lines around changes (default: 3)',
            required: false,
            type: 'number',
        },
    ];

    async processCommand(cmd: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const a = (cmd.parameters?.['a'] as string) ?? (cmd.value ?? '');
        const b = cmd.parameters?.['b'] as string;
        const contextLines = (cmd.parameters?.['context'] as number) ?? 3;

        if (!a || b === undefined) {
            context.writer.writeError(
                'Usage: diff --a "text1" --b "text2"\n' +
                '       echo "text1" | diff --b "text2"',
            );
            return;
        }

        const diffLines = computeDiff(a, b);
        const hasChanges = diffLines.some((l) => l.type !== 'same');

        if (!hasChanges) {
            context.writer.writeSuccess('No differences found');
            return;
        }

        const added = diffLines.filter((l) => l.type === 'add').length;
        const removed = diffLines.filter((l) => l.type === 'remove').length;
        context.writer.writeln(
            `\x1b[32m+${added} added\x1b[0m  \x1b[31m-${removed} removed\x1b[0m`,
        );
        context.writer.writeln('');

        const formatted = formatDiff(diffLines, contextLines);
        for (const line of formatted) {
            context.writer.writeln(line);
        }
    }
}
```

---

### Task 4: Register and test

**Files:**
- Modify: `packages/cli/src/lib/processors/index.ts`
- Modify: `packages/cli/src/lib/services/cli-boot.ts`

**Step 1: Export**
```typescript
export { CliDiffCommandProcessor } from './cli-diff-command-processor';
export { computeDiff, formatDiff } from './diff-utils';
```

**Step 2: Register**
Add `new CliDiffCommandProcessor()` to the built-in processors array.

**Step 3: Run tests**
```bash
npx nx test cli
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

**Step 4: Commit**
```bash
git add packages/cli/src/lib/processors/cli-diff-command-processor.ts \
        packages/cli/src/lib/processors/diff-utils.ts \
        packages/cli/src/lib/processors/index.ts \
        packages/cli/src/tests/diff.spec.ts
git commit -m "feat(cli): add diff command for colored line-by-line text comparison"
```

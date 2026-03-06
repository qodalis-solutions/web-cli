# CLI Core Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the CLI core with missing operators (`;`, `>`), pipe-aware file utilities, better process.exit(), process management (registry, ps, kill), and stderr stream capture.

**Architecture:** Changes span three layers: (1) the command parser and executor in `packages/cli/`, (2) the `ICliExecutionProcess` interface in `packages/core/`, and (3) the 13 file utility processors in `packages/plugins/files/`. Each priority builds on the previous — operators first, then piping, then process management.

**Tech Stack:** TypeScript, Jasmine (tests), tsup (build), xterm.js (terminal), RxJS (observables)

---

## Task 1: Add `;` and `>` Operators to Command Parser

**Files:**
- Modify: `packages/cli/src/lib/parsers/command-parser.ts:16-20,27,36-99`
- Test: `packages/cli/src/tests/command-parser.spec.ts`

**Step 1: Write failing tests for `;` and `>` operators**

Add to `packages/cli/src/tests/command-parser.spec.ts` at the end of the `CommandParser.splitByOperators` describe block:

```typescript
// -- ; operator --

it('should split two commands by ;', () => {
    const parts = CommandParser.splitByOperators('echo hello ; echo world');
    expect(parts).toEqual([
        { type: 'command', value: 'echo hello' },
        { type: ';', value: ';' },
        { type: 'command', value: 'echo world' },
    ]);
});

it('should split three commands by ;', () => {
    const parts = CommandParser.splitByOperators('a ; b ; c');
    expect(parts).toEqual([
        { type: 'command', value: 'a' },
        { type: ';', value: ';' },
        { type: 'command', value: 'b' },
        { type: ';', value: ';' },
        { type: 'command', value: 'c' },
    ]);
});

it('should handle ; with no spaces', () => {
    const parts = CommandParser.splitByOperators('a;b');
    expect(parts).toEqual([
        { type: 'command', value: 'a' },
        { type: ';', value: ';' },
        { type: 'command', value: 'b' },
    ]);
});

it('should not split on ; inside quoted strings', () => {
    const parts = CommandParser.splitByOperators('echo "a ; b"');
    expect(parts).toEqual([{ type: 'command', value: 'echo "a ; b"' }]);
});

it('should handle mixed ; and && operators', () => {
    const parts = CommandParser.splitByOperators('a ; b && c');
    expect(parts).toEqual([
        { type: 'command', value: 'a' },
        { type: ';', value: ';' },
        { type: 'command', value: 'b' },
        { type: '&&', value: '&&' },
        { type: 'command', value: 'c' },
    ]);
});

// -- > operator --

it('should split command and redirect target by >', () => {
    const parts = CommandParser.splitByOperators('echo hello > output.txt');
    expect(parts).toEqual([
        { type: 'command', value: 'echo hello' },
        { type: '>', value: '>' },
        { type: 'command', value: 'output.txt' },
    ]);
});

it('should distinguish > from >>', () => {
    const parts = CommandParser.splitByOperators('echo a > out.txt && echo b >> out.txt');
    expect(parts).toEqual([
        { type: 'command', value: 'echo a' },
        { type: '>', value: '>' },
        { type: 'command', value: 'out.txt' },
        { type: '&&', value: '&&' },
        { type: 'command', value: 'echo b' },
        { type: '>>', value: '>>' },
        { type: 'command', value: 'out.txt' },
    ]);
});

it('should not split on > inside quoted strings', () => {
    const parts = CommandParser.splitByOperators('echo "a > b"');
    expect(parts).toEqual([{ type: 'command', value: 'echo "a > b"' }]);
});
```

**Step 2: Run tests to verify they fail**

Run: `npx nx test cli --watch=false 2>&1 | tail -20`
Expected: FAIL — `>` and `;` types are not recognized

**Step 3: Update the CommandPart type and parser implementation**

In `packages/cli/src/lib/parsers/command-parser.ts`:

Update the `CommandPart` type at line 16:
```typescript
export type CommandPart = {
    /** 'command' for a command to execute, or the operator string */
    type: 'command' | '&&' | '||' | '>>' | '>' | '|' | ';';
    value: string;
};
```

Update the `OPERATORS` array at line 27:
```typescript
private static readonly OPERATORS = ['&&', '||', '>>', '>', '|', ';'] as const;
```

In `splitByOperators`, add handling for `>` (single char, after `>>` is already handled) and `;` (single char). After the pipe check (line 87), add:

```typescript
// Check for single-character > redirect (after >> is ruled out)
if (ch === '>') {
    const trimmed = current.trim();
    if (trimmed) {
        result.push({ type: 'command', value: trimmed });
    }
    current = '';
    result.push({ type: '>', value: '>' });
    continue;
}

// Check for ; sequential separator
if (ch === ';') {
    const trimmed = current.trim();
    if (trimmed) {
        result.push({ type: 'command', value: trimmed });
    }
    current = '';
    result.push({ type: ';', value: ';' });
    continue;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx nx test cli --watch=false 2>&1 | tail -20`
Expected: ALL PASS

**Step 5: Commit**

```
feat(cli): add ; and > operators to command parser
```

---

## Task 2: Handle `;` and `>` in the Command Executor

**Files:**
- Modify: `packages/cli/src/lib/executor/cli-command-executor.ts:58-139,141-175`
- Test: `packages/cli/src/tests/command-executor.spec.ts`

**Step 1: Write failing tests**

Add to `packages/cli/src/tests/command-executor.spec.ts`:

```typescript
// -----------------------------------------------------------------------
// Operator ; — sequential execution
// -----------------------------------------------------------------------
describe('Operator ; — sequential execution', () => {
    it('should run both commands regardless of first success', async () => {
        const calls: string[] = [];
        registry.registerProcessor(
            createTestProcessor('first', async () => {
                calls.push('first');
            }),
        );
        registry.registerProcessor(
            createTestProcessor('second', async () => {
                calls.push('second');
            }),
        );

        await executor.executeCommand('first ; second', context);

        expect(calls).toEqual(['first', 'second']);
    });

    it('should run second command even when first fails', async () => {
        const calls: string[] = [];
        registry.registerProcessor(
            createTestProcessor('fail', async (_cmd, ctx) => {
                calls.push('fail');
                ctx.process.exit(-1);
            }),
        );
        registry.registerProcessor(
            createTestProcessor('second', async () => {
                calls.push('second');
            }),
        );

        await executor.executeCommand('fail ; second', context);

        expect(calls).toEqual(['fail', 'second']);
    });

    it('should NOT pass pipeline data across ; boundary', async () => {
        let receivedData: any;
        registry.registerProcessor(
            createTestProcessor('producer', async (_cmd, ctx) => {
                ctx.process.output('some data');
            }),
        );
        registry.registerProcessor(
            createTestProcessor('consumer', async (cmd) => {
                receivedData = cmd.data;
            }),
        );

        await executor.executeCommand('producer ; consumer', context);

        expect(receivedData).toBeUndefined();
    });
});

// -----------------------------------------------------------------------
// Operator > — overwrite redirect
// -----------------------------------------------------------------------
describe('Operator > — overwrite redirect', () => {
    it('should write output to file via > redirect', async () => {
        // Set up a mock file system service
        let writtenPath: string | undefined;
        let writtenContent: string | undefined;
        const mockFs = {
            resolvePath: (p: string) => p.trim(),
            exists: () => false,
            createFile: (path: string, content: string) => {
                writtenPath = path;
                writtenContent = content;
            },
            writeFile: (path: string, content: string) => {
                writtenPath = path;
                writtenContent = content;
            },
            persist: async () => {},
        };
        (context.services as any).get = (token: any) => {
            if (token === 'cli-file-system-service') return mockFs;
            return (context.services as any).services?.get(token);
        };

        registry.registerProcessor(
            createTestProcessor('producer', async (_cmd, ctx) => {
                ctx.process.output('hello world');
            }),
        );

        await executor.executeCommand('producer > output.txt', context);

        expect(writtenPath).toBe('output.txt');
        expect(writtenContent).toBe('hello world');
    });

    it('should overwrite existing file with > redirect', async () => {
        let writtenContent: string | undefined;
        let appendMode: boolean | undefined;
        const mockFs = {
            resolvePath: (p: string) => p.trim(),
            exists: () => true,
            writeFile: (path: string, content: string, append?: boolean) => {
                writtenContent = content;
                appendMode = append;
            },
            persist: async () => {},
        };
        (context.services as any).get = (token: any) => {
            if (token === 'cli-file-system-service') return mockFs;
            return (context.services as any).services?.get(token);
        };

        registry.registerProcessor(
            createTestProcessor('producer', async (_cmd, ctx) => {
                ctx.process.output('new content');
            }),
        );

        await executor.executeCommand('producer > output.txt', context);

        expect(writtenContent).toBe('new content');
        // > should NOT append — it should overwrite
        expect(appendMode).toBeFalsy();
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx nx test cli --watch=false 2>&1 | tail -20`
Expected: FAIL

**Step 3: Implement `;` and `>` handling in the executor**

In `packages/cli/src/lib/executor/cli-command-executor.ts`, in the `executeCommand` method, add handling for the new operators in the for-loop (after the `>>` block):

For `;`: add before the `>>` check:
```typescript
} else if (part.type === ';') {
    // Sequential: always run next, reset pipeline data
    shouldRunNext = true;
    pipelineData = undefined;
    continue;
}
```

For `>`: add after the `>>` block:
```typescript
} else if (part.type === '>') {
    const nextPart = parts[i + 1];
    i++;
    if (!nextPart || nextPart.type !== 'command') {
        context.writer.writeError('Missing file path after >');
        lastExitSuccess = false;
        continue;
    }
    if (shouldRunNext) {
        await this.writeOutputToFile(nextPart.value, context);
        pipelineData = undefined;
    }
    continue;
}
```

Add the `writeOutputToFile` method (similar to `appendOutputToFile` but overwrites):

```typescript
private async writeOutputToFile(
    filePath: string,
    context: ICliExecutionContext,
): Promise<void> {
    const FS_TOKEN = 'cli-file-system-service';

    let fs: any;
    try {
        fs = context.services.get(FS_TOKEN);
    } catch {
        context.writer.writeError(
            '> redirect requires @qodalis/cli-files plugin',
        );
        return;
    }

    const output = context.process.data;
    if (output === undefined || output === null) {
        return;
    }

    try {
        const resolved = fs.resolvePath(filePath.trim());
        const content =
            typeof output === 'string' ? output : JSON.stringify(output);
        if (fs.exists(resolved)) {
            fs.writeFile(resolved, content); // overwrite (no append flag)
        } else {
            fs.createFile(resolved, content);
        }
        await fs.persist();
    } catch (e: any) {
        context.writer.writeError(`> failed: ${e.message || e}`);
    }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx nx test cli --watch=false 2>&1 | tail -20`
Expected: ALL PASS

**Step 5: Commit**

```
feat(cli): handle ; sequential and > overwrite operators in executor
```

---

## Task 3: Extract Shared Test Helpers for Files Plugin

The files plugin tests duplicate `createStubWriter`, `createMockContext`, and `makeCommand` in every test file. Before adding pipe-awareness tests, extract these into a shared helper.

**Files:**
- Create: `packages/plugins/files/src/tests/helpers.ts`
- Modify: `packages/plugins/files/src/tests/text-filtering-commands.spec.ts` (update imports)
- Modify: `packages/plugins/files/src/tests/pipe-commands.spec.ts` (update imports)

**Step 1: Create shared test helpers**

Create `packages/plugins/files/src/tests/helpers.ts`:

```typescript
import { Subject } from 'rxjs';
import {
    CliProcessCommand,
    CliForegroundColor,
    CliBackgroundColor,
    ICliExecutionContext,
    ICliTerminalWriter,
    ICliServiceProvider,
} from '@qodalis/cli-core';
import { IndexedDbFileSystemService } from '../lib/services';
import { IFileSystemService_TOKEN } from '../lib/interfaces';

export function createStubWriter(): ICliTerminalWriter & { written: string[] } {
    const written: string[] = [];
    return {
        written,
        write(text: string) { written.push(text); },
        writeln(text?: string) { written.push(text ?? ''); },
        writeSuccess(msg: string) { written.push(`[success] ${msg}`); },
        writeInfo(msg: string) { written.push(`[info] ${msg}`); },
        writeWarning(msg: string) { written.push(`[warn] ${msg}`); },
        writeError(msg: string) { written.push(`[error] ${msg}`); },
        wrapInColor(text: string, _color: CliForegroundColor) { return text; },
        wrapInBackgroundColor(text: string, _color: CliBackgroundColor) { return text; },
        writeJson(json: any) { written.push(JSON.stringify(json)); },
        writeToFile(_fn: string, _content: string) {},
        writeObjectsAsTable(objects: any[]) { written.push(JSON.stringify(objects)); },
        writeTable(_h: string[], _r: string[][]) {},
        writeDivider() {},
        writeList(_items: string[], _options?: any) {},
        writeKeyValue(_entries: any, _options?: any) {},
        writeColumns(_items: string[], _options?: any) {},
    };
}

export function createMockContext(
    writer: ICliTerminalWriter,
    fs: IndexedDbFileSystemService,
): ICliExecutionContext {
    const services: ICliServiceProvider = {
        get<T>(token: any): T {
            if (token === IFileSystemService_TOKEN) return fs as any;
            throw new Error(`Unknown service: ${token}`);
        },
        set() {},
    };

    return {
        writer,
        services,
        spinner: { show() {}, hide() {} },
        progressBar: { show() {}, update() {}, hide() {} },
        onAbort: new Subject<void>(),
        terminal: {} as any,
        reader: {} as any,
        executor: {} as any,
        clipboard: {} as any,
        options: undefined,
        logger: { log() {}, info() {}, warn() {}, error() {}, debug() {}, setCliLogLevel() {} },
        process: { output() {}, exit() {} } as any,
        state: {} as any,
        showPrompt: jasmine.createSpy('showPrompt'),
        setContextProcessor: jasmine.createSpy('setContextProcessor'),
        setCurrentLine: jasmine.createSpy('setCurrentLine'),
        clearLine: jasmine.createSpy('clearLine'),
        clearCurrentLine: jasmine.createSpy('clearCurrentLine'),
        refreshCurrentLine: jasmine.createSpy('refreshCurrentLine'),
        enterFullScreenMode: jasmine.createSpy('enterFullScreenMode'),
        exitFullScreenMode: jasmine.createSpy('exitFullScreenMode'),
    } as any;
}

export function makeCommand(
    raw: string,
    args: Record<string, any> = {},
    data?: any,
): CliProcessCommand {
    const tokens = raw.split(/\s+/);
    return {
        command: tokens[0],
        rawCommand: tokens.slice(1).join(' '),
        chainCommands: [],
        args,
        data,
    } as any;
}
```

**Step 2: Update existing test files to import from helpers**

In both `text-filtering-commands.spec.ts` and `pipe-commands.spec.ts`, replace the duplicated `createStubWriter`, `createMockContext`, and `makeCommand` functions with imports from `./helpers`.

**Step 3: Run tests to verify nothing broke**

Run: `npx nx test files --watch=false 2>&1 | tail -20`
Expected: ALL PASS

**Step 4: Commit**

```
refactor(files): extract shared test helpers
```

---

## Task 4: Make `grep` Pipe-Aware

**Files:**
- Modify: `packages/plugins/files/src/lib/processors/cli-grep-command-processor.ts:68-213`
- Test: `packages/plugins/files/src/tests/search-commands.spec.ts`

**Step 1: Write failing tests for piped grep**

Add to `packages/plugins/files/src/tests/search-commands.spec.ts` (import helpers):

```typescript
describe('CliGrepCommandProcessor (piped input)', () => {
    let processor: CliGrepCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliGrepCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should search piped text when no file paths given', async () => {
        const cmd = makeCommand('grep hello', {}, 'hello world\ngoodbye world\nhello again');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('hello world');
        expect(output).toContain('hello again');
        expect(output).not.toContain('goodbye');
    });

    it('should apply -i flag on piped input', async () => {
        const cmd = makeCommand('grep -i HELLO', { i: true }, 'Hello World\ngoodbye');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Hello World');
    });

    it('should apply -v invert on piped input', async () => {
        const cmd = makeCommand('grep -v hello', { v: true }, 'hello\nworld\nhello again');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('world');
        expect(output).not.toContain('hello');
    });

    it('should apply -c count on piped input', async () => {
        const cmd = makeCommand('grep -c hello', { c: true }, 'hello\nworld\nhello again');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('2');
    });

    it('should apply -n line numbers on piped input', async () => {
        const cmd = makeCommand('grep -n hello', { n: true }, 'hello\nworld\nhello again');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('1');
        expect(output).toContain('3');
    });

    it('should still require a pattern even with piped input', async () => {
        const cmd = makeCommand('grep', {}, 'some data');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(w => w.includes('missing pattern'))).toBeTrue();
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx nx test files --watch=false 2>&1 | tail -20`
Expected: FAIL — grep errors with "missing file operand" when data is piped

**Step 3: Modify grep to accept piped input**

In `packages/plugins/files/src/lib/processors/cli-grep-command-processor.ts`, modify `processCommand`:

After parsing pattern and paths (line 93-104), replace the `if (paths.length === 0)` error block:

```typescript
// If no file paths given, check for piped data
if (paths.length === 0) {
    if (command.data != null) {
        const content = typeof command.data === 'string'
            ? command.data
            : JSON.stringify(command.data);
        this.grepContent(content, null, regex, {
            ignoreCase, showLineNum, countOnly, filesOnly, invert,
        }, context, false);
        return;
    }
    context.writer.writeError(
        'grep: missing file operand. Usage: grep [options] <pattern> <file>',
    );
    return;
}
```

Extract the per-file grep logic into a `grepContent` helper method:

```typescript
private grepContent(
    content: string,
    filePath: string | null,
    regex: RegExp,
    options: {
        ignoreCase: boolean;
        showLineNum: boolean;
        countOnly: boolean;
        filesOnly: boolean;
        invert: boolean;
    },
    context: ICliExecutionContext,
    multiFile: boolean,
): void {
    const lines = content.split('\n');
    let matchCount = 0;
    const matchingLines: { num: number; text: string }[] = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        regex.lastIndex = 0;
        const hasMatch = regex.test(line);
        const isMatch = options.invert ? !hasMatch : hasMatch;

        if (isMatch) {
            matchCount++;
            matchingLines.push({ num: lineIdx + 1, text: line });
        }
    }

    if (options.filesOnly) {
        if (matchCount > 0 && filePath) {
            context.writer.writeln(filePath);
        }
    } else if (options.countOnly) {
        const prefix = multiFile && filePath ? `${filePath}:` : '';
        context.writer.writeln(`${prefix}${matchCount}`);
    } else {
        for (const m of matchingLines) {
            const parts: string[] = [];
            if (multiFile && filePath) {
                parts.push(context.writer.wrapInColor(filePath, CliForegroundColor.Magenta));
                parts.push(':');
            }
            if (options.showLineNum) {
                parts.push(context.writer.wrapInColor(String(m.num), CliForegroundColor.Green));
                parts.push(':');
            }
            if (!options.invert) {
                regex.lastIndex = 0;
                const highlighted = m.text.replace(regex, (match) =>
                    context.writer.wrapInColor(match, CliForegroundColor.Red),
                );
                parts.push(highlighted);
            } else {
                parts.push(m.text);
            }
            context.writer.writeln(parts.join(''));
        }
    }
}
```

Then refactor the existing file-based loop to call `grepContent` too.

**Step 4: Run tests to verify they pass**

Run: `npx nx test files --watch=false 2>&1 | tail -20`
Expected: ALL PASS

**Step 5: Commit**

```
feat(files): make grep pipe-aware — accept piped input when no file given
```

---

## Task 5: Make `head` and `tail` Pipe-Aware

**Files:**
- Modify: `packages/plugins/files/src/lib/processors/cli-head-command-processor.ts`
- Modify: `packages/plugins/files/src/lib/processors/cli-tail-command-processor.ts`
- Test: `packages/plugins/files/src/tests/simple-commands.spec.ts`

**Step 1: Write failing tests**

Add to `packages/plugins/files/src/tests/simple-commands.spec.ts`:

```typescript
describe('CliHeadCommandProcessor (piped input)', () => {
    // ... setup boilerplate ...

    it('should display first N lines of piped input', async () => {
        const input = 'line1\nline2\nline3\nline4\nline5';
        const cmd = makeCommand('head -n 3', { n: '3' }, input);
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('line1');
        expect(output).toContain('line3');
        expect(output).not.toContain('line4');
    });

    it('should default to 10 lines for piped input', async () => {
        const lines = Array.from({ length: 15 }, (_, i) => `line${i + 1}`).join('\n');
        const cmd = makeCommand('head', {}, lines);
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('line10');
        expect(output).not.toContain('line11');
    });
});

describe('CliTailCommandProcessor (piped input)', () => {
    // ... setup boilerplate ...

    it('should display last N lines of piped input', async () => {
        const input = 'line1\nline2\nline3\nline4\nline5';
        const cmd = makeCommand('tail -n 2', { n: '2' }, input);
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('line4');
        expect(output).toContain('line5');
        expect(output).not.toContain('line3');
    });
});
```

**Step 2: Run tests to verify they fail**

**Step 3: Modify head and tail**

In both `cli-head-command-processor.ts` and `cli-tail-command-processor.ts`, add piped input handling after `parsePaths`:

```typescript
if (paths.length === 0) {
    if (command.data != null) {
        const content = typeof command.data === 'string'
            ? command.data : JSON.stringify(command.data);
        const lines = content.split('\n');
        const selected = /* head: lines.slice(0, count) / tail: lines.slice(-count) */;
        context.writer.writeln(selected.join('\n'));
        return;
    }
    context.writer.writeError('head: missing file operand'); // or 'tail:'
    return;
}
```

The `parsePaths` method strips the command name from `rawCommand`, so when piped, `rawCommand` might be empty or just flags. No file is found, and we fall through to the piped data check.

**Step 4: Run tests to verify they pass**

**Step 5: Commit**

```
feat(files): make head and tail pipe-aware
```

---

## Task 6: Make `sort` and `uniq` Pipe-Aware

**Files:**
- Modify: `packages/plugins/files/src/lib/processors/cli-sort-command-processor.ts`
- Modify: `packages/plugins/files/src/lib/processors/cli-uniq-command-processor.ts`
- Test: `packages/plugins/files/src/tests/text-filtering-commands.spec.ts`

**Step 1: Write failing tests**

Add to `packages/plugins/files/src/tests/text-filtering-commands.spec.ts`:

```typescript
describe('CliSortCommandProcessor (piped input)', () => {
    // ... setup ...

    it('should sort piped text', async () => {
        const cmd = makeCommand('sort', {}, 'banana\napple\ncherry');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['apple', 'banana', 'cherry']);
    });

    it('should sort piped text numerically with -n', async () => {
        const cmd = makeCommand('sort -n', { n: true }, '3\n1\n2');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['1', '2', '3']);
    });

    it('should sort piped text in reverse with -r', async () => {
        const cmd = makeCommand('sort -r', { r: true }, 'a\nc\nb');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['c', 'b', 'a']);
    });
});

describe('CliUniqCommandProcessor (piped input)', () => {
    // ... setup ...

    it('should deduplicate piped text', async () => {
        const cmd = makeCommand('uniq', {}, 'a\na\nb\nc\nc');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['a', 'b', 'c']);
    });

    it('should count duplicates with -c on piped input', async () => {
        const cmd = makeCommand('uniq -c', { c: true }, 'a\na\nb');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('2 a');
        expect(output).toContain('1 b');
    });
});
```

**Step 2: Run tests to verify they fail**

**Step 3: Add piped input fallback**

Same pattern: when `paths.length === 0 && command.data != null`, use piped data as content. Extract the sorting/deduplication logic from the file loop body into a helper method that takes `content: string`, then call it for both piped and file-based input.

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```
feat(files): make sort and uniq pipe-aware
```

---

## Task 7: Make `wc`, `cut`, `tac` Pipe-Aware

**Files:**
- Modify: `packages/plugins/files/src/lib/processors/cli-wc-command-processor.ts`
- Modify: `packages/plugins/files/src/lib/processors/cli-cut-command-processor.ts`
- Modify: `packages/plugins/files/src/lib/processors/cli-tac-command-processor.ts`
- Test: `packages/plugins/files/src/tests/text-filtering-commands.spec.ts`

Same pattern as Task 6. Write tests for piped input, then add the `command.data` fallback. Key details:

- **wc**: when piped, don't show filename suffix, just counts
- **cut**: when piped, apply field/char extraction to piped lines
- **tac**: when piped, reverse lines of piped text

**Step 1: Write failing tests**

```typescript
describe('CliWcCommandProcessor (piped input)', () => {
    it('should count lines/words/chars of piped text', async () => {
        const cmd = makeCommand('wc', {}, 'hello world\nfoo bar baz');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('');
        expect(output).toContain('2'); // 2 lines
        expect(output).toContain('5'); // 5 words
    });

    it('should count only lines with -l on piped input', async () => {
        const cmd = makeCommand('wc -l', { l: true }, 'a\nb\nc');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('');
        expect(output).toContain('3');
    });
});

describe('CliCutCommandProcessor (piped input)', () => {
    it('should cut fields from piped text', async () => {
        const cmd = makeCommand('cut -d , -f 2', { d: ',', f: '2' }, 'a,b,c\n1,2,3');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['b', '2']);
    });
});

describe('CliTacCommandProcessor (piped input)', () => {
    it('should reverse piped lines', async () => {
        const cmd = makeCommand('tac', {}, 'first\nsecond\nthird');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['third', 'second', 'first']);
    });
});
```

**Step 2-4: Run, implement, verify**

**Step 5: Commit**

```
feat(files): make wc, cut, tac pipe-aware
```

---

## Task 8: Make `sed`, `awk`, `tr` Pipe-Aware

**Files:**
- Modify: `packages/plugins/files/src/lib/processors/cli-sed-command-processor.ts`
- Modify: `packages/plugins/files/src/lib/processors/cli-awk-command-processor.ts`
- Modify: `packages/plugins/files/src/lib/processors/cli-tr-command-processor.ts`
- Test: `packages/plugins/files/src/tests/sed-command.spec.ts`
- Test: `packages/plugins/files/src/tests/awk-command.spec.ts`
- Test: `packages/plugins/files/src/tests/tr-command.spec.ts`

These are more complex since they have their own arg parsing. The approach:

- **sed**: when `filePath` is null and `command.data` exists, use piped data as content
- **awk**: when `filePath` is null and `command.data` exists, use piped data as content
- **tr**: when `filePath` is not found and `command.data` exists, use piped data as content

**Step 1: Write tests for each**

```typescript
// sed
it('should process piped input with substitution', async () => {
    const cmd = makeCommand("sed 's/hello/world/g'", {}, 'hello there\nhello again');
    await processor.processCommand(cmd, ctx);
    const output = writer.written.join('\n');
    expect(output).toContain('world there');
    expect(output).toContain('world again');
});

// awk
it('should process piped input', async () => {
    const cmd = makeCommand("awk '{print $1}'", {}, 'hello world\nfoo bar');
    await processor.processCommand(cmd, ctx);
    const output = writer.written.join('\n');
    expect(output).toContain('hello');
    expect(output).toContain('foo');
});

// tr
it('should translate piped input', async () => {
    const cmd = makeCommand("tr 'a-z' 'A-Z'", {}, 'hello');
    // Note: tr needs special handling — positional args change when piped
    await processor.processCommand(cmd, ctx);
    const output = writer.written.join('\n');
    expect(output).toContain('HELLO');
});
```

**Step 2-4: Run, implement, verify**

**Step 5: Commit**

```
feat(files): make sed, awk, tr pipe-aware
```

---

## Task 9: Make `tee` and `xargs` Pipe-Aware

**Files:**
- Modify: `packages/plugins/files/src/lib/processors/cli-tee-command-processor.ts`
- Modify: `packages/plugins/files/src/lib/processors/cli-xargs-command-processor.ts`
- Test: `packages/plugins/files/src/tests/pipe-commands.spec.ts`

**tee** with piped input: `echo "text" | tee file1.txt file2.txt` — reads from piped data, writes to stdout AND the specified files.

**xargs** with piped input: `echo "a\nb\nc" | xargs echo` — reads args from piped data instead of a file.

**Step 1: Write tests**

```typescript
describe('CliTeeCommandProcessor (piped input)', () => {
    it('should write piped data to stdout and output files', async () => {
        const cmd = makeCommand('tee /home/user/out.txt', {}, 'piped content');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('piped content');
        expect(fs.readFile('/home/user/out.txt')).toBe('piped content');
    });

    it('should append piped data with -a', async () => {
        fs.createFile('/home/user/existing.txt', 'old\n');
        const cmd = makeCommand('tee -a /home/user/existing.txt', { a: true }, 'new');
        await processor.processCommand(cmd, ctx);
        const content = fs.readFile('/home/user/existing.txt');
        expect(content).toContain('old');
        expect(content).toContain('new');
    });
});

describe('CliXargsCommandProcessor (piped input)', () => {
    it('should build commands from piped data', async () => {
        const cmd = makeCommand('xargs echo', {}, 'hello\nworld\nfoo');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('echo hello world foo');
    });

    it('should support -I replace with piped data', async () => {
        const cmd = makeCommand('xargs -I {} cat {}', { I: '{}' }, 'a\nb');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('cat a');
        expect(output).toContain('cat b');
    });
});
```

**Step 2: Implement**

For **tee**: when `command.data` exists and no input file is provided, use `command.data` as content. All positional args become output files (not input+output split).

For **xargs**: when `command.data` exists and no input file is provided, use `command.data` split by newlines as the args list. All positional args form the command template.

**Step 3-4: Run tests, verify**

**Step 5: Commit**

```
feat(files): make tee and xargs pipe-aware
```

---

## Task 10: Improve `process.exit()` — Silent Exit Termination

**Files:**
- Modify: `packages/core/src/lib/interfaces/index.ts:261-309` (ICliExecutionProcess)
- Modify: `packages/cli/src/lib/context/cli-execution-process.ts`
- Modify: `packages/cli/src/lib/executor/cli-command-executor.ts:331-386`
- Test: `packages/cli/src/tests/command-executor.spec.ts`

**Step 1: Write failing test**

```typescript
describe('process.exit() improvements', () => {
    it('should stop pipeline on silent exit with non-zero code', async () => {
        const calls: string[] = [];
        registry.registerProcessor(
            createTestProcessor('fail-silent', async (_cmd, ctx) => {
                calls.push('fail-silent');
                ctx.process.exit(-1, { silent: true });
            }),
        );
        registry.registerProcessor(
            createTestProcessor('after', async () => {
                calls.push('after');
            }),
        );

        await executor.executeCommand('fail-silent && after', context);

        // Silent exit with code -1 should stop the && chain
        expect(calls).toEqual(['fail-silent']);
    });

    it('should set exitCode on silent exit', async () => {
        registry.registerProcessor(
            createTestProcessor('cmd', async (_cmd, ctx) => {
                ctx.process.exit(42, { silent: true });
            }),
        );

        await executor.executeCommand('cmd', context);

        expect(context.process.exitCode).toBe(42);
    });
});
```

**Step 2: Run tests**

The second test may already pass (exitCode is set). The first test may fail because `exit(-1, { silent: true })` doesn't throw, so `process.end()` is called with exitCode 0.

**Step 3: Fix silent exit handling**

In `CliExecutionProcess.exit()`, always set `exitCode`:

```typescript
exit(
    code?: number,
    options?: { silent?: boolean },
) {
    code = code ?? 0;
    this.exited = true;
    this.exitCode = code;
    this.running = false;

    if (!options?.silent) {
        throw new ProcessExitedError(code);
    }
}
```

In `CliCommandExecutor.executeSingleCommand()`, after `await cancellable.execute()` and after hooks, check if the process was silently exited:

```typescript
// After hooks...

// Auto-capture...
if (!process.outputCalled && capturingWriter.hasOutput()) {
    process.data = capturingWriter.getCapturedData();
}

// Only call end() if the process wasn't silently exited
if (!process.exited) {
    process.end();
}
```

This way, silent exit properly sets the exit code without overriding it with 0 in `end()`.

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```
fix(cli): silent process.exit() now properly sets exit code and terminates pipeline
```

---

## Task 11: Add Per-Command AbortController (Signal on Context)

**Files:**
- Modify: `packages/core/src/lib/interfaces/execution-context.ts` (add `signal`)
- Modify: `packages/cli/src/lib/executor/cli-command-executor.ts`
- Modify: `packages/cli/src/lib/context/cli-command-execution-context.ts`
- Test: `packages/cli/src/tests/command-executor.spec.ts`

**Step 1: Add `signal` to ICliExecutionContext**

In `packages/core/src/lib/interfaces/execution-context.ts`, add to the interface:

```typescript
/**
 * Abort signal for the current command. Fires when the command is
 * cancelled via Ctrl+C or killed. Commands should check this signal
 * or listen to onAbort for cooperative cancellation.
 */
signal?: AbortSignal;
```

**Step 2: Create AbortController per command in executor**

In `executeSingleCommand`, create an AbortController before creating `CliCommandExecutionContext`:

```typescript
const commandAbortController = new AbortController();

const commandContext = new CliCommandExecutionContext(
    context,
    processor,
);
commandContext.signal = commandAbortController.signal;
```

Wire it so that `context.onAbort` fires `commandAbortController.abort()`:

```typescript
const abortSub = context.onAbort.subscribe(() => {
    commandAbortController.abort();
});
```

Clean up the subscription after the command completes (in finally block):

```typescript
try {
    // ... existing code ...
} catch (e) {
    // ... existing handling ...
} finally {
    abortSub.unsubscribe();
}
```

**Step 3: Write test**

```typescript
it('should provide an AbortSignal on the command context', async () => {
    let signal: AbortSignal | undefined;
    registry.registerProcessor(
        createTestProcessor('cmd', async (_cmd, ctx) => {
            signal = ctx.signal;
        }),
    );

    await executor.executeCommand('cmd', context);

    expect(signal).toBeDefined();
    expect(signal!.aborted).toBe(false);
});
```

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```
feat(cli): add per-command AbortController with signal on execution context
```

---

## Task 12: Add Process Registry, `ps` Command, and `kill` Command

**Files:**
- Create: `packages/cli/src/lib/services/cli-process-registry.ts`
- Create: `packages/cli/src/lib/processors/system/cli-ps-command-processor.ts`
- Create: `packages/cli/src/lib/processors/system/cli-kill-command-processor.ts`
- Modify: `packages/cli/src/lib/executor/cli-command-executor.ts` (register processes)
- Modify: `packages/core/src/lib/interfaces/index.ts` (add ICliProcessRegistry, ICliProcessEntry)
- Modify: `packages/cli/src/lib/processors/index.ts` (export new processors)
- Test: `packages/cli/src/tests/command-executor.spec.ts`

**Step 1: Define the interface in core**

Add to `packages/core/src/lib/interfaces/index.ts`:

```typescript
export interface ICliProcessEntry {
    pid: number;
    command: string;
    startTime: number;
    status: 'running' | 'completed' | 'failed' | 'killed';
    exitCode?: number;
}

export interface ICliProcessRegistry {
    /** Register a new process, returns assigned PID */
    register(command: string): { pid: number; abortController: AbortController };
    /** Mark process as completed */
    complete(pid: number, exitCode: number): void;
    /** Mark process as failed */
    fail(pid: number): void;
    /** Kill a process by PID */
    kill(pid: number): boolean;
    /** List all processes (running + recent completed) */
    list(): ICliProcessEntry[];
    /** Get the current foreground process PID */
    readonly currentPid: number | undefined;
}
```

**Step 2: Implement CliProcessRegistry**

Create `packages/cli/src/lib/services/cli-process-registry.ts`:

```typescript
import { ICliProcessEntry, ICliProcessRegistry } from '@qodalis/cli-core';

export const CliProcessRegistry_TOKEN = 'cli-process-registry';

export class CliProcessRegistry implements ICliProcessRegistry {
    private nextPid = 1;
    private processes = new Map<number, ICliProcessEntry & { abortController: AbortController }>();
    private _currentPid: number | undefined;
    private maxHistory = 50;

    get currentPid(): number | undefined {
        return this._currentPid;
    }

    register(command: string): { pid: number; abortController: AbortController } {
        const pid = this.nextPid++;
        const abortController = new AbortController();
        this.processes.set(pid, {
            pid,
            command,
            startTime: Date.now(),
            status: 'running',
            abortController,
        });
        this._currentPid = pid;
        this.pruneHistory();
        return { pid, abortController };
    }

    complete(pid: number, exitCode: number): void {
        const entry = this.processes.get(pid);
        if (entry && entry.status === 'running') {
            entry.status = 'completed';
            entry.exitCode = exitCode;
        }
        if (this._currentPid === pid) {
            this._currentPid = undefined;
        }
    }

    fail(pid: number): void {
        const entry = this.processes.get(pid);
        if (entry && entry.status === 'running') {
            entry.status = 'failed';
            entry.exitCode = -1;
        }
        if (this._currentPid === pid) {
            this._currentPid = undefined;
        }
    }

    kill(pid: number): boolean {
        const entry = this.processes.get(pid);
        if (!entry || entry.status !== 'running') return false;
        entry.abortController.abort();
        entry.status = 'killed';
        entry.exitCode = -9;
        if (this._currentPid === pid) {
            this._currentPid = undefined;
        }
        return true;
    }

    list(): ICliProcessEntry[] {
        return Array.from(this.processes.values()).map(({ abortController, ...entry }) => entry);
    }

    private pruneHistory(): void {
        const entries = Array.from(this.processes.entries());
        const completed = entries.filter(([, e]) => e.status !== 'running');
        if (completed.length > this.maxHistory) {
            const toRemove = completed.slice(0, completed.length - this.maxHistory);
            for (const [pid] of toRemove) {
                this.processes.delete(pid);
            }
        }
    }
}
```

**Step 3: Create `ps` command processor**

Create `packages/cli/src/lib/processors/system/cli-ps-command-processor.ts`:

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliProcessRegistry,
} from '@qodalis/cli-core';
import { CliProcessRegistry_TOKEN } from '../../services/cli-process-registry';

export class CliPsCommandProcessor implements ICliCommandProcessor {
    command = 'ps';
    description = 'List running and recent processes';
    author = DefaultLibraryAuthor;
    metadata = { icon: '📋', sealed: true };

    async processCommand(
        _command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const registry = context.services.get<ICliProcessRegistry>(
            CliProcessRegistry_TOKEN,
        );
        const processes = registry.list();

        if (processes.length === 0) {
            context.writer.writeInfo('No processes');
            return;
        }

        const headers = ['PID', 'STATUS', 'EXIT', 'TIME', 'COMMAND'];
        const rows = processes.map((p) => {
            const elapsed = p.status === 'running'
                ? `${Math.round((Date.now() - p.startTime) / 1000)}s`
                : `${Math.round((Date.now() - p.startTime) / 1000)}s`;
            return [
                String(p.pid),
                p.status,
                p.exitCode !== undefined ? String(p.exitCode) : '-',
                elapsed,
                p.command,
            ];
        });

        context.writer.writeTable(headers, rows);
    }
}
```

**Step 4: Create `kill` command processor**

Create `packages/cli/src/lib/processors/system/cli-kill-command-processor.ts`:

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliProcessRegistry,
} from '@qodalis/cli-core';
import { CliProcessRegistry_TOKEN } from '../../services/cli-process-registry';

export class CliKillCommandProcessor implements ICliCommandProcessor {
    command = 'kill';
    description = 'Terminate a running process by PID';
    author = DefaultLibraryAuthor;
    valueRequired = true;
    metadata = { icon: '💀', sealed: true };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const registry = context.services.get<ICliProcessRegistry>(
            CliProcessRegistry_TOKEN,
        );
        const pidStr = command.value?.trim();
        if (!pidStr) {
            context.writer.writeError('kill: missing PID');
            return;
        }
        const pid = parseInt(pidStr, 10);
        if (isNaN(pid)) {
            context.writer.writeError(`kill: invalid PID: ${pidStr}`);
            return;
        }
        if (registry.kill(pid)) {
            context.writer.writeSuccess(`Killed process ${pid}`);
        } else {
            context.writer.writeError(`kill: no running process with PID ${pid}`);
        }
    }
}
```

**Step 5: Wire registry into executor**

In `executeSingleCommand`, use the process registry if available:

```typescript
let processEntry: { pid: number; abortController: AbortController } | undefined;
try {
    const procRegistry = context.services.get<ICliProcessRegistry>(CliProcessRegistry_TOKEN);
    processEntry = procRegistry.register(command);
} catch {
    // Registry not available — proceed without it
}

// ... existing execution code ...

// In the finally/success path:
if (processEntry) {
    const procRegistry = context.services.get<ICliProcessRegistry>(CliProcessRegistry_TOKEN);
    procRegistry.complete(processEntry.pid, context.process.exitCode ?? 0);
}

// In the error path:
if (processEntry) {
    const procRegistry = context.services.get<ICliProcessRegistry>(CliProcessRegistry_TOKEN);
    procRegistry.fail(processEntry.pid);
}
```

**Step 6: Register the new processors and service**

Add `ps` and `kill` to the built-in processors list. Register `CliProcessRegistry` as a service during boot.

**Step 7: Write tests**

```typescript
describe('Process Registry', () => {
    it('should track executed commands with PIDs', async () => {
        // Register the process registry service
        const { CliProcessRegistry, CliProcessRegistry_TOKEN } = await import(
            '../lib/services/cli-process-registry'
        );
        const procRegistry = new CliProcessRegistry();
        (context.services as any).get = (token: any) => {
            if (token === CliProcessRegistry_TOKEN) return procRegistry;
            return undefined;
        };

        registry.registerProcessor(
            createTestProcessor('cmd', async () => {}),
        );

        await executor.executeCommand('cmd', context);

        const processes = procRegistry.list();
        expect(processes.length).toBeGreaterThan(0);
        expect(processes[0].command).toBe('cmd');
        expect(processes[0].status).toBe('completed');
    });
});
```

**Step 8: Run all tests, verify pass**

Run: `npx nx test cli --watch=false 2>&1 | tail -20`
Expected: ALL PASS

**Step 9: Commit**

```
feat(cli): add process registry with ps and kill commands
```

---

## Task 13: Add Stderr Capture to CapturingTerminalWriter

**Files:**
- Modify: `packages/cli/src/lib/services/capturing-terminal-writer.ts`
- Modify: `packages/cli/src/lib/parsers/command-parser.ts` (add `2>`, `2>>`)
- Modify: `packages/cli/src/lib/executor/cli-command-executor.ts` (handle stderr redirects)
- Test: `packages/cli/src/tests/capturing-terminal-writer.spec.ts`
- Test: `packages/cli/src/tests/command-parser.spec.ts`

**Step 1: Add stderr capture to CapturingTerminalWriter**

Add a `_stderrLines` buffer alongside `_lines`. Capture `writeError` and `writeWarning` calls:

```typescript
private _stderrLines: string[] = [];

writeError(message: string): void {
    this._stderrLines.push(stripAnsi(message));
    this.inner.writeError(message);
}

writeWarning(message: string): void {
    this._stderrLines.push(stripAnsi(message));
    this.inner.writeWarning(message);
}

hasStderr(): boolean {
    return this._stderrLines.length > 0;
}

getCapturedStderr(): string | undefined {
    if (this._stderrLines.length === 0) return undefined;
    return this._stderrLines.join('\n').trim() || undefined;
}
```

**Step 2: Add `2>` and `2>>` operators to parser**

Update the `CommandPart` type:
```typescript
type: 'command' | '&&' | '||' | '>>' | '>' | '2>>' | '2>' | '|' | ';';
```

In `splitByOperators`, check for `2>>` and `2>` (before the general `>>` and `>` checks):

```typescript
// Check for 2>> and 2>
if (input.slice(i, i + 3) === '2>>') {
    // ... emit 2>> operator, skip 2 extra chars
}
if (input.slice(i, i + 2) === '2>') {
    // ... emit 2> operator, skip 1 extra char
}
```

**Step 3: Handle stderr redirects in executor**

In `executeCommand`, handle `2>` and `2>>` by reading `capturingWriter.getCapturedStderr()` and writing to the target file.

**Step 4: Write tests**

```typescript
it('should capture stderr separately from stdout', () => {
    const inner = createStubWriter();
    const capturing = new CapturingTerminalWriter(inner);
    capturing.writeln('stdout line');
    capturing.writeError('stderr line');
    expect(capturing.getCapturedData()).toBe('stdout line');
    expect(capturing.getCapturedStderr()).toBe('stderr line');
});
```

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```
feat(cli): add stderr capture and 2>/2>> redirect operators
```

---

## Task 14: Build and Verify Everything

**Step 1: Build all packages**

Run: `pnpm run build 2>&1 | tail -30`
Expected: All 31 projects build successfully

**Step 2: Run all tests**

Run: `pnpm test 2>&1 | tail -30`
Expected: All tests pass

**Step 3: Kill any leftover processes**

Run: `pkill -f "karma|ChromeHeadless" 2>/dev/null; ps aux | grep "nx.js\|karma\|ChromeHeadless" | grep -v grep`
Expected: No leftover processes

**Step 4: Final commit**

```
chore: verify build and tests after CLI core improvements
```

---

## Summary of Changes

| Priority | Tasks | What Changes |
|----------|-------|-------------|
| P2: Operators | 1-2 | Parser recognizes `;` and `>`, executor handles them |
| P1: Pipe-awareness | 3-9 | 13 file processors accept `command.data` as stdin |
| P4: process.exit | 10 | Silent exit properly sets exitCode and stops pipeline |
| P3: Process mgmt | 11-12 | Per-command AbortController, process registry, `ps`, `kill` |
| P5: Streams | 13 | Stderr capture, `2>` and `2>>` redirect |

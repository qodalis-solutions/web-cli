# Font Size Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `font-size` built-in command with sub-commands `increase`, `decrease`, `reset`, and `set <n>` that adjusts the xterm.js terminal font size at runtime and persists the setting.

**Architecture:** New command processor in `packages/cli/src/lib/processors/cli-font-size-command-processor.ts`. Uses `context.terminal.options.fontSize` for live adjustment and `context.state` for persistence. Registered in the CLI boot alongside other built-in processors.

**Tech Stack:** TypeScript, xterm.js Terminal options API, CliStateStore

---

### Task 1: Write failing tests

**Files:**
- Create: `packages/cli/src/tests/font-size.spec.ts`

**Step 1: Write tests**

```typescript
import { CliTestHarness } from '../lib/testing/cli-test-harness';

describe('font-size command', () => {
    let harness: CliTestHarness;

    beforeEach(async () => {
        harness = await CliTestHarness.create();
    });

    afterEach(() => harness.destroy());

    it('font-size increase raises font size by 2', async () => {
        const before = harness.context.terminal.options.fontSize as number;
        await harness.execute('font-size increase');
        expect(harness.context.terminal.options.fontSize).toBe(before + 2);
    });

    it('font-size decrease lowers font size by 2', async () => {
        const before = harness.context.terminal.options.fontSize as number;
        await harness.execute('font-size decrease');
        expect(harness.context.terminal.options.fontSize).toBe(before - 2);
    });

    it('font-size set 14 sets exact size', async () => {
        await harness.execute('font-size set 14');
        expect(harness.context.terminal.options.fontSize).toBe(14);
    });

    it('font-size reset restores default (20)', async () => {
        await harness.execute('font-size set 30');
        await harness.execute('font-size reset');
        expect(harness.context.terminal.options.fontSize).toBe(20);
    });

    it('font-size decrease does not go below 8', async () => {
        await harness.execute('font-size set 8');
        await harness.execute('font-size decrease');
        expect(harness.context.terminal.options.fontSize).toBe(8);
    });

    it('font-size increase does not go above 40', async () => {
        await harness.execute('font-size set 40');
        await harness.execute('font-size increase');
        expect(harness.context.terminal.options.fontSize).toBe(40);
    });
});
```

**Step 2: Run tests to confirm they fail**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
npx nx test cli --testFile=src/tests/font-size.spec.ts
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

Expected: FAILED — `font-size` command not found.

---

### Task 2: Implement the processor

**Files:**
- Create: `packages/cli/src/lib/processors/cli-font-size-command-processor.ts`

**Step 1: Write the implementation**

```typescript
import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandAuthor,
    CliProcessorMetadata,
    CliIcon,
    CliStateConfiguration,
    DefaultLibraryAuthor,
    CliForegroundColor,
} from '@qodalis/cli-core';

const DEFAULT_FONT_SIZE = 20;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 40;
const STEP = 2;

interface FontSizeState {
    fontSize: number;
}

export class CliFontSizeCommandProcessor implements ICliCommandProcessor {
    command = 'font-size';
    description = 'Adjust the terminal font size';
    aliases = ['fontsize'];
    author: ICliCommandAuthor = DefaultLibraryAuthor;
    metadata: CliProcessorMetadata = { icon: CliIcon.Settings, module: 'system' };

    stateConfiguration: CliStateConfiguration = {
        storeName: 'font-size',
        initialState: { fontSize: DEFAULT_FONT_SIZE } as FontSizeState,
    };

    processors: ICliCommandProcessor[] = [
        {
            command: 'increase',
            description: `Increase font size by ${STEP}px (max ${MAX_FONT_SIZE})`,
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                this.setFontSize(context, this.getCurrent(context) + STEP);
            },
        },
        {
            command: 'decrease',
            description: `Decrease font size by ${STEP}px (min ${MIN_FONT_SIZE})`,
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                this.setFontSize(context, this.getCurrent(context) - STEP);
            },
        },
        {
            command: 'reset',
            description: `Reset font size to default (${DEFAULT_FONT_SIZE}px)`,
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                this.setFontSize(context, DEFAULT_FONT_SIZE);
            },
        },
        {
            command: 'set',
            description: 'Set font size to a specific value',
            valueRequired: true,
            acceptsRawInput: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const n = parseInt(cmd.value ?? '', 10);
                if (isNaN(n) || n < MIN_FONT_SIZE || n > MAX_FONT_SIZE) {
                    context.writer.writeError(
                        `Font size must be between ${MIN_FONT_SIZE} and ${MAX_FONT_SIZE}`,
                    );
                    return;
                }
                this.setFontSize(context, n);
            },
        },
    ];

    async initialize(context: ICliExecutionContext): Promise<void> {
        const state = context.state.getState<FontSizeState>();
        if (state.fontSize && state.fontSize !== DEFAULT_FONT_SIZE) {
            context.terminal.options.fontSize = state.fontSize;
        }
    }

    async processCommand(_: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const current = this.getCurrent(context);
        context.writer.writeKeyValue('Current font size', `${current}px`);
        context.writer.writeln();
        context.writer.writeln('Usage:');
        context.writer.writeln(
            `  ${context.writer.wrapInColor('font-size increase', CliForegroundColor.Cyan)}   Increase by ${STEP}px`,
        );
        context.writer.writeln(
            `  ${context.writer.wrapInColor('font-size decrease', CliForegroundColor.Cyan)}   Decrease by ${STEP}px`,
        );
        context.writer.writeln(
            `  ${context.writer.wrapInColor('font-size set <n>', CliForegroundColor.Cyan)}    Set to exact size`,
        );
        context.writer.writeln(
            `  ${context.writer.wrapInColor('font-size reset', CliForegroundColor.Cyan)}      Reset to default (${DEFAULT_FONT_SIZE}px)`,
        );
    }

    private getCurrent(context: ICliExecutionContext): number {
        return (context.terminal.options.fontSize as number) ?? DEFAULT_FONT_SIZE;
    }

    private setFontSize(context: ICliExecutionContext, size: number): void {
        const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
        context.terminal.options.fontSize = clamped;
        context.state.updateState({ fontSize: clamped } as FontSizeState);
        context.state.persist();
        context.writer.writeSuccess(`Font size set to ${clamped}px`);
    }
}
```

---

### Task 3: Register the processor

**Files:**
- Modify: `packages/cli/src/lib/processors/index.ts`

**Step 1: Export and register**

Add to the processors index file:
```typescript
export { CliFontSizeCommandProcessor } from './cli-font-size-command-processor';
```

Then find where `systemProcessors` or the built-in processors array is assembled (search for where `CliAliasCommandProcessor` or `CliEchoCommandProcessor` is registered) and add `new CliFontSizeCommandProcessor()` to that array.

The main boot file is at `packages/cli/src/lib/services/cli-boot.ts` — find the array of built-in processors and add the new one.

**Step 2: Run tests**

```bash
npx nx test cli
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

Expected: all tests pass including the new font-size tests.

**Step 3: Commit**

```bash
git add packages/cli/src/lib/processors/cli-font-size-command-processor.ts \
        packages/cli/src/lib/processors/index.ts \
        packages/cli/src/tests/font-size.spec.ts
git commit -m "feat(cli): add font-size command (increase/decrease/set/reset)"
```

# Command Snippets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `snippet` command for saving and reusing parameterized command templates. Users save a named snippet like `curl -X POST {{url}} -H "Content-Type: application/json" -d '{{body}}'`, then run it by providing variable values.

**Architecture:** New processor in `packages/cli/src/lib/processors/cli-snippet-command-processor.ts`. State stored via `CliStateStore` (IndexedDB-backed). Template variables use `{{name}}` syntax. Subcommands: `save`, `list`, `run`, `delete`, `show`.

**Tech Stack:** TypeScript, CliStateStore

---

### Task 1: Write failing tests

**Files:**
- Create: `packages/cli/src/tests/snippet.spec.ts`

**Step 1: Write tests**

```typescript
import { CliTestHarness } from '../lib/testing/cli-test-harness';

describe('snippet command', () => {
    let harness: CliTestHarness;

    beforeEach(async () => {
        harness = await CliTestHarness.create();
    });

    afterEach(() => harness.destroy());

    it('snippet list shows empty message when no snippets', async () => {
        const output = await harness.captureOutput(() =>
            harness.execute('snippet list'),
        );
        expect(output).toContain('No snippets');
    });

    it('snippet save stores a snippet', async () => {
        await harness.execute('snippet save greet "echo Hello {{name}}"');
        const output = await harness.captureOutput(() =>
            harness.execute('snippet list'),
        );
        expect(output).toContain('greet');
    });

    it('snippet show displays snippet template', async () => {
        await harness.execute('snippet save greet "echo Hello {{name}}"');
        const output = await harness.captureOutput(() =>
            harness.execute('snippet show greet'),
        );
        expect(output).toContain('{{name}}');
    });

    it('snippet delete removes a snippet', async () => {
        await harness.execute('snippet save greet "echo Hello {{name}}"');
        await harness.execute('snippet delete greet');
        const output = await harness.captureOutput(() =>
            harness.execute('snippet list'),
        );
        expect(output).toContain('No snippets');
    });
});
```

**Step 2: Run tests — expect failure**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
npx nx test cli --testFile=src/tests/snippet.spec.ts
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

---

### Task 2: Implement the snippet processor

**Files:**
- Create: `packages/cli/src/lib/processors/cli-snippet-command-processor.ts`

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

interface SnippetState {
    snippets: Record<string, string>;
}

export class CliSnippetCommandProcessor implements ICliCommandProcessor {
    command = 'snippet';
    description = 'Save and reuse parameterized command templates';
    aliases = ['snip'];
    author: ICliCommandAuthor = DefaultLibraryAuthor;
    metadata: CliProcessorMetadata = { icon: CliIcon.Code, module: 'system' };

    stateConfiguration: CliStateConfiguration = {
        storeName: 'snippets',
        initialState: { snippets: {} } as SnippetState,
    };

    processors: ICliCommandProcessor[] = [
        {
            command: 'list',
            description: 'List all saved snippets',
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                const { snippets } = context.state.getState<SnippetState>();
                const entries = Object.entries(snippets);
                if (entries.length === 0) {
                    context.writer.writeInfo('No snippets saved yet. Use: snippet save <name> "<template>"');
                    return;
                }
                context.writer.writeln(
                    context.writer.wrapInColor('Saved snippets:', CliForegroundColor.Yellow),
                );
                for (const [name, template] of entries) {
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor(name, CliForegroundColor.Cyan)}  ${template}`,
                    );
                }
            },
        },
        {
            command: 'save',
            description: 'Save a new snippet: snippet save <name> "<template>"',
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const parts = (cmd.value ?? '').match(/^(\S+)\s+"(.+)"$|^(\S+)\s+(.+)$/);
                if (!parts) {
                    context.writer.writeError('Usage: snippet save <name> "<template>"');
                    return;
                }
                const name = parts[1] ?? parts[3];
                const template = parts[2] ?? parts[4];
                const state = context.state.getState<SnippetState>();
                state.snippets[name] = template;
                context.state.updateState({ snippets: { ...state.snippets } });
                await context.state.persist();
                context.writer.writeSuccess(`Snippet "${name}" saved`);
            },
        },
        {
            command: 'show',
            description: 'Show a snippet template: snippet show <name>',
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const name = (cmd.value ?? '').trim();
                const { snippets } = context.state.getState<SnippetState>();
                if (!snippets[name]) {
                    context.writer.writeError(`Snippet "${name}" not found`);
                    return;
                }
                context.writer.writeln(
                    `${context.writer.wrapInColor(name, CliForegroundColor.Cyan)}: ${snippets[name]}`,
                );
            },
        },
        {
            command: 'delete',
            description: 'Delete a snippet: snippet delete <name>',
            aliases: ['rm', 'remove'],
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const name = (cmd.value ?? '').trim();
                const state = context.state.getState<SnippetState>();
                if (!state.snippets[name]) {
                    context.writer.writeError(`Snippet "${name}" not found`);
                    return;
                }
                delete state.snippets[name];
                context.state.updateState({ snippets: { ...state.snippets } });
                await context.state.persist();
                context.writer.writeSuccess(`Snippet "${name}" deleted`);
            },
        },
        {
            command: 'run',
            description: 'Run a snippet with variable values: snippet run <name> var1=val1 var2=val2',
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const raw = (cmd.value ?? '').trim();
                const spaceIdx = raw.indexOf(' ');
                const name = spaceIdx === -1 ? raw : raw.slice(0, spaceIdx);
                const argsStr = spaceIdx === -1 ? '' : raw.slice(spaceIdx + 1).trim();

                const { snippets } = context.state.getState<SnippetState>();
                if (!snippets[name]) {
                    context.writer.writeError(`Snippet "${name}" not found`);
                    return;
                }

                // Parse key=value pairs
                const vars: Record<string, string> = {};
                const varPattern = /(\w+)=(?:"([^"]*)"|([\S]*))/g;
                let match: RegExpExecArray | null;
                while ((match = varPattern.exec(argsStr)) !== null) {
                    vars[match[1]] = match[2] ?? match[3] ?? '';
                }

                // Replace {{var}} placeholders
                let resolved = snippets[name];
                for (const [key, value] of Object.entries(vars)) {
                    resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
                }

                // Check for unresolved variables
                const missing = [...resolved.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
                if (missing.length > 0) {
                    context.writer.writeError(
                        `Missing variables: ${missing.join(', ')}. Usage: snippet run ${name} ${missing.map((v) => `${v}=value`).join(' ')}`,
                    );
                    return;
                }

                context.writer.writeInfo(`Running: ${resolved}`);
                await context.executor.executeCommand(resolved, context);
            },
        },
    ];

    async processCommand(_: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { snippets } = context.state.getState<SnippetState>();
        const count = Object.keys(snippets).length;
        context.writer.writeln(
            `${count} snippet(s) saved. Sub-commands: list, save, show, run, delete`,
        );
    }
}
```

---

### Task 3: Register and test

**Files:**
- Modify: `packages/cli/src/lib/processors/index.ts`
- Modify: `packages/cli/src/lib/services/cli-boot.ts`

**Step 1: Export**

Add to `packages/cli/src/lib/processors/index.ts`:
```typescript
export { CliSnippetCommandProcessor } from './cli-snippet-command-processor';
```

**Step 2: Register**

Add `new CliSnippetCommandProcessor()` to the built-in processors array in `cli-boot.ts`.

**Step 3: Run tests**

```bash
npx nx test cli
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

Expected: all tests pass.

**Step 4: Commit**

```bash
git add packages/cli/src/lib/processors/cli-snippet-command-processor.ts \
        packages/cli/src/lib/processors/index.ts \
        packages/cli/src/tests/snippet.spec.ts
git commit -m "feat(cli): add snippet command for parameterized command templates"
```

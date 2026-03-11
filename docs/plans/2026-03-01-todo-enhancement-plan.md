# Todo Plugin Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance `@qodalis/cli-todo` from a minimal CRUD todo list to a practical daily-use task manager with editing, toggle, due dates, filtered listing, and confirmation for destructive ops.

**Architecture:** Extract TodoItem type and date utilities into a utilities module. Rewrite the processor with 6 sub-commands (ls, add, rm, done, edit, toggle). Enhance completion provider for new commands. All date parsing is built-in (no deps).

**Tech Stack:** TypeScript, CLI State Store for persistence, Jasmine for tests. Build: tsup (CJS + ESM + IIFE).

**Design doc:** `docs/plans/2026-03-01-todo-enhancement-design.md`

---

### Task 1: Create utilities module with TodoItem type and date functions

**Files:**
- Create: `packages/plugins/todo/src/lib/utilities/index.ts`

**Step 1: Create the utilities file**

```typescript
export type TodoItem = {
    id: number;
    text: string;
    completed: boolean;
    createdAt: string;
    completedAt?: string;
    dueDate?: string;
};

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function parseDueDate(input: string): string | null {
    const trimmed = input.trim().toLowerCase();
    const now = new Date();
    const today = startOfDay(now);

    if (trimmed === 'today') {
        return today.toISOString();
    }

    if (trimmed === 'tomorrow') {
        const d = new Date(today);
        d.setDate(d.getDate() + 1);
        return d.toISOString();
    }

    if (trimmed === 'yesterday') {
        const d = new Date(today);
        d.setDate(d.getDate() - 1);
        return d.toISOString();
    }

    if (trimmed === 'next week') {
        const d = new Date(today);
        d.setDate(d.getDate() + 7);
        return d.toISOString();
    }

    if (trimmed === 'next month') {
        const d = new Date(today);
        d.setMonth(d.getMonth() + 1);
        return d.toISOString();
    }

    const dayIndex = DAY_NAMES.indexOf(trimmed);
    if (dayIndex !== -1) {
        const d = new Date(today);
        const currentDay = d.getDay();
        let daysUntil = dayIndex - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        d.setDate(d.getDate() + daysUntil);
        return d.toISOString();
    }

    // Try ISO format YYYY-MM-DD
    const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);
    if (isoMatch) {
        const d = new Date(trimmed + 'T00:00:00');
        if (!isNaN(d.getTime())) {
            return startOfDay(d).toISOString();
        }
    }

    return null;
}

export function formatRelativeDate(isoDate: string): string {
    const target = startOfDay(new Date(isoDate));
    const today = startOfDay(new Date());
    const diffMs = target.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'due: today';
    if (diffDays === 1) return 'due: tomorrow';
    if (diffDays === -1) return 'overdue: yesterday';
    if (diffDays > 1 && diffDays <= 14) return `due: in ${diffDays} days`;
    if (diffDays < -1) return `overdue: ${Math.abs(diffDays)} days ago`;

    // Far future: show month + day
    const d = new Date(isoDate);
    return `due: ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export function isOverdue(todo: TodoItem): boolean {
    if (todo.completed || !todo.dueDate) return false;
    const target = startOfDay(new Date(todo.dueDate));
    const today = startOfDay(new Date());
    return target.getTime() < today.getTime();
}

export function migrateTodoItem(item: any): TodoItem {
    return {
        id: item.id,
        text: item.text,
        completed: item.completed ?? false,
        createdAt: item.createdAt ?? new Date().toISOString(),
        completedAt: item.completedAt,
        dueDate: item.dueDate,
    };
}

export function lineThroughText(text: string): string {
    return text
        .split('')
        .map((char) => char + '\u0336')
        .join('');
}
```

**Step 2: Commit**

```bash
git add packages/plugins/todo/src/lib/utilities/index.ts
git commit -m "feat(todo): add utilities module with TodoItem type and date functions"
```

---

### Task 2: Rewrite the command processor

**Files:**
- Rewrite: `packages/plugins/todo/src/lib/processors/cli-todo-command-processor.ts`

**Step 1: Replace the entire processor file**

```typescript
import {
    CliForegroundColor,
    CliIcon,
    CliProcessCommand,
    CliProcessorMetadata,
    CliStateConfiguration,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';
import {
    TodoItem,
    formatRelativeDate,
    isOverdue,
    lineThroughText,
    migrateTodoItem,
    parseDueDate,
} from '../utilities';

export class CliTodoCommandProcessor implements ICliCommandProcessor {
    command = 'todo';

    description = 'Manage your tasks from the terminal. Add, list, edit, complete, and remove TODO items.';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        icon: '📝',
        requiredCoreVersion: '>=2.0.0 <3.0.0',
        requiredCliVersion: '>=2.0.0 <3.0.0',
    };

    stateConfiguration?: CliStateConfiguration = {
        initialState: {
            todos: this.loadFromOldStorage() ?? [],
        },
    };

    private todos: TodoItem[] = [];

    private nextId = 1;

    getTodos(): TodoItem[] {
        return this.todos;
    }

    constructor() {
        this.registerSubProcessors();
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description!);
        writer.writeln();
        writer.writeln(writer.wrapInColor('Commands:', CliForegroundColor.Yellow));
        writer.writeln(`  ${writer.wrapInColor('todo ls', CliForegroundColor.Cyan)}                    List all tasks`);
        writer.writeln(`  ${writer.wrapInColor('todo ls --pending', CliForegroundColor.Cyan)}          List pending tasks only`);
        writer.writeln(`  ${writer.wrapInColor('todo ls --completed', CliForegroundColor.Cyan)}        List completed tasks only`);
        writer.writeln(`  ${writer.wrapInColor('todo ls --overdue', CliForegroundColor.Cyan)}          List overdue tasks only`);
        writer.writeln(`  ${writer.wrapInColor('todo add <text>', CliForegroundColor.Cyan)}            Add a new task`);
        writer.writeln(`  ${writer.wrapInColor('todo add <text> --due <date>', CliForegroundColor.Cyan)}  Add with due date`);
        writer.writeln(`  ${writer.wrapInColor('todo edit <id> <new text>', CliForegroundColor.Cyan)}  Edit a task`);
        writer.writeln(`  ${writer.wrapInColor('todo done <id>', CliForegroundColor.Cyan)}             Mark a task as done`);
        writer.writeln(`  ${writer.wrapInColor('todo toggle <id>', CliForegroundColor.Cyan)}           Toggle done/undone`);
        writer.writeln(`  ${writer.wrapInColor('todo rm <id>', CliForegroundColor.Cyan)}               Remove a task`);
        writer.writeln(`  ${writer.wrapInColor('todo rm --all', CliForegroundColor.Cyan)}              Remove all tasks`);
        writer.writeln();
        writer.writeln(writer.wrapInColor('Due date formats:', CliForegroundColor.Yellow));
        writer.writeln(`  today, tomorrow, monday..sunday, next week, next month, YYYY-MM-DD`);
        writer.writeln();
        writer.writeln(writer.wrapInColor('Examples:', CliForegroundColor.Yellow));
        writer.writeln(`  todo add Buy groceries --due tomorrow`);
        writer.writeln(`  todo ls --pending`);
        writer.writeln(`  todo edit 3 Buy organic groceries`);
        writer.writeln(`  todo done 1`);
        writer.writeln(`  todo toggle 2`);
    }

    async initialize(context: ICliExecutionContext): Promise<void> {
        context.state
            .select<TodoItem[]>((x) => x['todos'])
            .subscribe((todos) => {
                this.todos = (todos || []).map(migrateTodoItem);
                this.nextId =
                    this.todos.length > 0
                        ? Math.max(...this.todos.map((t) => t.id)) + 1
                        : 1;
            });
    }

    private formatTodoLine(todo: TodoItem, writer: any): string {
        const check = todo.completed
            ? writer.wrapInColor(CliIcon.CheckIcon, CliForegroundColor.Green)
            : ' ';

        const text = todo.completed ? lineThroughText(todo.text) : todo.text;
        let suffix = '';

        if (todo.completed) {
            suffix = writer.wrapInColor('  done', CliForegroundColor.Green);
        } else if (todo.dueDate) {
            const rel = formatRelativeDate(todo.dueDate);
            const color = isOverdue(todo) ? CliForegroundColor.Red : CliForegroundColor.Yellow;
            suffix = '  ' + writer.wrapInColor(rel, color);
        }

        return `  [${check}] #${todo.id} - ${text}${suffix}`;
    }

    private registerSubProcessors(): void {
        this.processors = [
            // ── ls ──────────────────────────────────────────────
            {
                command: 'ls',
                aliases: ['list'],
                description: 'List TODO items',
                parameters: [
                    {
                        name: 'pending',
                        description: 'Show only pending tasks',
                        type: 'boolean',
                        required: false,
                    },
                    {
                        name: 'completed',
                        description: 'Show only completed tasks',
                        type: 'boolean',
                        required: false,
                    },
                    {
                        name: 'overdue',
                        description: 'Show only overdue tasks',
                        type: 'boolean',
                        required: false,
                    },
                ],
                processCommand: async (command, context) => {
                    if (this.todos.length === 0) {
                        context.writer.writeWarning('No tasks yet.');
                        context.writer.writeln('Use "todo add <text>" to create one.');
                        context.process.output([]);
                        return;
                    }

                    let filtered = [...this.todos];
                    const args = command.args;

                    if (args['pending']) {
                        filtered = filtered.filter((t) => !t.completed);
                    } else if (args['completed']) {
                        filtered = filtered.filter((t) => t.completed);
                    } else if (args['overdue']) {
                        filtered = filtered.filter((t) => isOverdue(t));
                    }

                    const doneCount = this.todos.filter((t) => t.completed).length;
                    context.writer.writeln(
                        context.writer.wrapInColor(
                            `Todos (${doneCount}/${this.todos.length} done)`,
                            CliForegroundColor.Cyan,
                        ),
                    );

                    if (filtered.length === 0) {
                        context.writer.writeln('  No matching tasks.');
                    } else {
                        filtered.forEach((todo) => {
                            context.writer.writeln(
                                this.formatTodoLine(todo, context.writer),
                            );
                        });
                    }

                    context.process.output(filtered);
                },
            },

            // ── add ─────────────────────────────────────────────
            {
                command: 'add',
                description: 'Add a new task',
                acceptsRawInput: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'due',
                        description: 'Due date (today, tomorrow, monday..sunday, next week, next month, YYYY-MM-DD)',
                        type: 'string',
                        required: false,
                    },
                ],
                processCommand: async (command, context) => {
                    const text = command.value;
                    if (!text) {
                        context.writer.writeError('Please provide a task description.');
                        return;
                    }

                    let dueDate: string | undefined;
                    const dueArg = command.args['due'];
                    if (dueArg) {
                        const parsed = parseDueDate(dueArg);
                        if (!parsed) {
                            context.writer.writeError(
                                `Invalid due date: "${dueArg}". Use: today, tomorrow, monday..sunday, next week, next month, or YYYY-MM-DD.`,
                            );
                            return;
                        }
                        dueDate = parsed;
                    }

                    const newItem: TodoItem = {
                        id: this.nextId++,
                        text,
                        completed: false,
                        createdAt: new Date().toISOString(),
                        dueDate,
                    };

                    this.todos.push(newItem);
                    await this.saveToStorage(context);

                    let msg = `Added: "${text}"`;
                    if (dueDate) {
                        msg += ` (${formatRelativeDate(dueDate)})`;
                    }
                    context.writer.writeSuccess(msg);
                    context.process.output(newItem);
                },
            },

            // ── edit ────────────────────────────────────────────
            {
                command: 'edit',
                description: 'Edit a task\'s text or due date',
                acceptsRawInput: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'due',
                        description: 'New due date (or "none" to remove)',
                        type: 'string',
                        required: false,
                    },
                ],
                processCommand: async (command, context) => {
                    const raw = command.value || '';
                    const spaceIndex = raw.indexOf(' ');

                    const idStr = spaceIndex === -1 ? raw : raw.substring(0, spaceIndex);
                    const newText = spaceIndex === -1 ? undefined : raw.substring(spaceIndex + 1).trim();

                    const id = parseInt(idStr, 10);
                    if (isNaN(id)) {
                        context.writer.writeError('Usage: todo edit <id> <new text> [--due <date>]');
                        return;
                    }

                    const todo = this.todos.find((t) => t.id === id);
                    if (!todo) {
                        context.writer.writeError(`Task #${id} not found.`);
                        return;
                    }

                    const dueArg = command.args['due'];
                    let changed = false;

                    if (newText) {
                        todo.text = newText;
                        changed = true;
                    }

                    if (dueArg) {
                        if (dueArg === 'none') {
                            todo.dueDate = undefined;
                            changed = true;
                        } else {
                            const parsed = parseDueDate(dueArg);
                            if (!parsed) {
                                context.writer.writeError(`Invalid due date: "${dueArg}".`);
                                return;
                            }
                            todo.dueDate = parsed;
                            changed = true;
                        }
                    }

                    if (!changed) {
                        context.writer.writeError('Nothing to update. Provide new text or --due.');
                        return;
                    }

                    await this.saveToStorage(context);
                    context.writer.writeSuccess(`Updated task #${id}.`);
                    context.process.output(todo);
                },
            },

            // ── done ────────────────────────────────────────────
            {
                command: 'done',
                aliases: ['complete'],
                description: 'Mark a task as done',
                acceptsRawInput: true,
                valueRequired: true,
                processCommand: async (command, context) => {
                    const id = parseInt(command.value || '', 10);
                    if (isNaN(id)) {
                        context.writer.writeError('Please provide a valid task ID.');
                        return;
                    }

                    const todo = this.todos.find((t) => t.id === id);
                    if (!todo) {
                        context.writer.writeError(`Task #${id} not found.`);
                        return;
                    }

                    if (todo.completed) {
                        context.writer.writeInfo(`Task #${id} is already done.`);
                        return;
                    }

                    todo.completed = true;
                    todo.completedAt = new Date().toISOString();
                    await this.saveToStorage(context);
                    context.writer.writeSuccess(`Done: "${todo.text}"`);
                    context.process.output(todo);
                },
            },

            // ── toggle ──────────────────────────────────────────
            {
                command: 'toggle',
                description: 'Toggle a task between done and undone',
                acceptsRawInput: true,
                valueRequired: true,
                processCommand: async (command, context) => {
                    const id = parseInt(command.value || '', 10);
                    if (isNaN(id)) {
                        context.writer.writeError('Please provide a valid task ID.');
                        return;
                    }

                    const todo = this.todos.find((t) => t.id === id);
                    if (!todo) {
                        context.writer.writeError(`Task #${id} not found.`);
                        return;
                    }

                    todo.completed = !todo.completed;
                    todo.completedAt = todo.completed ? new Date().toISOString() : undefined;
                    await this.saveToStorage(context);

                    const status = todo.completed ? 'done' : 'reopened';
                    context.writer.writeSuccess(`Task #${id} marked as ${status}.`);
                    context.process.output(todo);
                },
            },

            // ── rm ──────────────────────────────────────────────
            {
                command: 'rm',
                aliases: ['remove'],
                description: 'Remove a task by ID',
                acceptsRawInput: true,
                parameters: [
                    {
                        name: 'all',
                        description: 'Remove all tasks',
                        type: 'boolean',
                        defaultValue: false,
                        aliases: ['a'],
                        required: false,
                    },
                ],
                processCommand: async (command, context) => {
                    if (command.args['all'] || command.args['a']) {
                        if (this.todos.length === 0) {
                            context.writer.writeInfo('No tasks to remove.');
                            return;
                        }

                        const confirmed = await context.inputReader.readConfirm(
                            `Remove all ${this.todos.length} tasks?`,
                            false,
                        );

                        if (!confirmed) {
                            context.writer.writeInfo('Cancelled.');
                            return;
                        }

                        this.todos = [];
                        await this.saveToStorage(context);
                        context.writer.writeSuccess('Removed all tasks.');
                        return;
                    }

                    const id = parseInt(command.value!, 10);
                    if (isNaN(id)) {
                        context.writer.writeError('Please provide a valid task ID.');
                        return;
                    }

                    const index = this.todos.findIndex((t) => t.id === id);
                    if (index === -1) {
                        context.writer.writeError(`Task #${id} not found.`);
                        return;
                    }

                    const removed = this.todos.splice(index, 1)[0];
                    await this.saveToStorage(context);
                    context.writer.writeSuccess(`Removed: "${removed.text}"`);
                },
            },
        ];
    }

    private loadFromOldStorage(): TodoItem[] {
        const data = localStorage.getItem('todo-items');
        if (!data) return [];
        try {
            return (JSON.parse(data) as any[]).map(migrateTodoItem);
        } catch {
            return [];
        }
    }

    private async saveToStorage(context: ICliExecutionContext): Promise<void> {
        context.state.updateState({ todos: this.todos });
        await context.state.persist();
        localStorage.removeItem('todo-items');
    }
}
```

**Step 2: Commit**

```bash
git add packages/plugins/todo/src/lib/processors/cli-todo-command-processor.ts
git commit -m "feat(todo): rewrite processor with edit, toggle, due dates, filters

Adds edit, toggle, done (alias: complete) commands. Enhanced ls
with --pending/--completed/--overdue filters and progress header.
Due dates with natural language support. Confirmation for rm --all.
Strikethrough for completed tasks. Overdue highlighting."
```

---

### Task 3: Update completion provider for new commands

**Files:**
- Modify: `packages/plugins/todo/src/lib/completion/cli-todo-id-completion-provider.ts`

**Step 1: Replace the completion provider to support new commands**

```typescript
import {
    ICliCompletionProvider,
    ICliCompletionContext,
} from '@qodalis/cli-core';
import { CliTodoCommandProcessor } from '../processors/cli-todo-command-processor';

const TODO_ID_SUBCOMMANDS = new Set(['rm', 'done', 'complete', 'toggle', 'edit']);

export class CliTodoIdCompletionProvider
    implements ICliCompletionProvider
{
    priority = 50;

    constructor(
        private readonly todoProcessor: CliTodoCommandProcessor,
    ) {}

    getCompletions(context: ICliCompletionContext): string[] {
        const { tokens, tokenIndex, token } = context;

        if (tokenIndex !== 2 || tokens.length < 2) {
            return [];
        }

        const rootCommand = tokens[0].toLowerCase();
        if (rootCommand !== 'todo') {
            return [];
        }

        const subCommand = tokens[1].toLowerCase();
        if (!TODO_ID_SUBCOMMANDS.has(subCommand)) {
            return [];
        }

        const todos = this.todoProcessor.getTodos();
        const lowerPrefix = token.toLowerCase();

        // For 'done' and 'complete', only show non-completed todos
        const filtered =
            subCommand === 'done' || subCommand === 'complete'
                ? todos.filter((t) => !t.completed)
                : todos;

        return filtered
            .map((t) => String(t.id))
            .filter((id) => id.startsWith(lowerPrefix))
            .sort((a, b) => Number(a) - Number(b));
    }
}
```

**Step 2: Commit**

```bash
git add packages/plugins/todo/src/lib/completion/cli-todo-id-completion-provider.ts
git commit -m "feat(todo): update completion provider for new commands"
```

---

### Task 4: Update public-api.ts to export utilities

**Files:**
- Modify: `packages/plugins/todo/src/public-api.ts`

**Step 1: Add utilities export**

Add `export * from './lib/utilities';` after the existing exports. The file should become:

```typescript
/*
 * Public API Surface of todo
 */

export * from './lib/utilities';
export * from './lib/processors/cli-todo-command-processor';
export * from './lib/completion/cli-todo-id-completion-provider';

import {
    ICliModule,
    ICliCompletionProvider_TOKEN,
} from '@qodalis/cli-core';
import { CliTodoCommandProcessor } from './lib/processors/cli-todo-command-processor';
import { CliTodoIdCompletionProvider } from './lib/completion/cli-todo-id-completion-provider';
import { API_VERSION } from './lib/version';

const todoProcessor = new CliTodoCommandProcessor();

export const todoModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-todo',
    processors: [todoProcessor],
    services: [
        {
            provide: ICliCompletionProvider_TOKEN,
            useValue: new CliTodoIdCompletionProvider(todoProcessor),
            multi: true,
        },
    ],
};
```

**Step 2: Commit**

```bash
git add packages/plugins/todo/src/public-api.ts
git commit -m "feat(todo): export utilities from public API"
```

---

### Task 5: Rewrite tests

**Files:**
- Rewrite: `packages/plugins/todo/src/tests/index.spec.ts`

**Step 1: Replace the test file**

```typescript
import { CliTodoCommandProcessor } from '../lib/processors/cli-todo-command-processor';
import {
    parseDueDate,
    formatRelativeDate,
    isOverdue,
    migrateTodoItem,
    lineThroughText,
    TodoItem,
} from '../lib/utilities';

// ── Utility tests ───────────────────────────────────────────

describe('Todo Utilities', () => {
    describe('parseDueDate', () => {
        it('should parse "today"', () => {
            const result = parseDueDate('today');
            expect(result).toBeDefined();
            const d = new Date(result!);
            const now = new Date();
            expect(d.getFullYear()).toBe(now.getFullYear());
            expect(d.getMonth()).toBe(now.getMonth());
            expect(d.getDate()).toBe(now.getDate());
        });

        it('should parse "tomorrow"', () => {
            const result = parseDueDate('tomorrow');
            expect(result).toBeDefined();
            const d = new Date(result!);
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            expect(d.getDate()).toBe(tomorrow.getDate());
        });

        it('should parse "yesterday"', () => {
            const result = parseDueDate('yesterday');
            expect(result).toBeDefined();
            const d = new Date(result!);
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            expect(d.getDate()).toBe(yesterday.getDate());
        });

        it('should parse "next week"', () => {
            const result = parseDueDate('next week');
            expect(result).toBeDefined();
            const d = new Date(result!);
            const expected = new Date();
            expected.setDate(expected.getDate() + 7);
            expect(d.getDate()).toBe(expected.getDate());
        });

        it('should parse "next month"', () => {
            const result = parseDueDate('next month');
            expect(result).toBeDefined();
            const d = new Date(result!);
            const expected = new Date();
            expected.setMonth(expected.getMonth() + 1);
            expect(d.getMonth()).toBe(expected.getMonth());
        });

        it('should parse day names', () => {
            const result = parseDueDate('monday');
            expect(result).toBeDefined();
            const d = new Date(result!);
            expect(d.getDay()).toBe(1); // Monday
        });

        it('should parse ISO dates', () => {
            const result = parseDueDate('2026-06-15');
            expect(result).toBeDefined();
            const d = new Date(result!);
            expect(d.getFullYear()).toBe(2026);
            expect(d.getMonth()).toBe(5); // June (0-indexed)
            expect(d.getDate()).toBe(15);
        });

        it('should return null for invalid input', () => {
            expect(parseDueDate('not a date')).toBeNull();
            expect(parseDueDate('abc123')).toBeNull();
        });

        it('should be case-insensitive', () => {
            expect(parseDueDate('TODAY')).toBeDefined();
            expect(parseDueDate('Tomorrow')).toBeDefined();
            expect(parseDueDate('MONDAY')).toBeDefined();
        });
    });

    describe('formatRelativeDate', () => {
        it('should format today', () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            expect(formatRelativeDate(today.toISOString())).toBe('due: today');
        });

        it('should format tomorrow', () => {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            d.setHours(0, 0, 0, 0);
            expect(formatRelativeDate(d.toISOString())).toBe('due: tomorrow');
        });

        it('should format yesterday as overdue', () => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            d.setHours(0, 0, 0, 0);
            expect(formatRelativeDate(d.toISOString())).toBe('overdue: yesterday');
        });

        it('should format near future days', () => {
            const d = new Date();
            d.setDate(d.getDate() + 5);
            d.setHours(0, 0, 0, 0);
            expect(formatRelativeDate(d.toISOString())).toBe('due: in 5 days');
        });

        it('should format past days as overdue', () => {
            const d = new Date();
            d.setDate(d.getDate() - 3);
            d.setHours(0, 0, 0, 0);
            expect(formatRelativeDate(d.toISOString())).toBe('overdue: 3 days ago');
        });
    });

    describe('isOverdue', () => {
        it('should return false for completed todos', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const todo: TodoItem = {
                id: 1, text: 'test', completed: true,
                createdAt: new Date().toISOString(),
                dueDate: yesterday.toISOString(),
            };
            expect(isOverdue(todo)).toBe(false);
        });

        it('should return false for todos without due date', () => {
            const todo: TodoItem = {
                id: 1, text: 'test', completed: false,
                createdAt: new Date().toISOString(),
            };
            expect(isOverdue(todo)).toBe(false);
        });

        it('should return true for past due incomplete todos', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const todo: TodoItem = {
                id: 1, text: 'test', completed: false,
                createdAt: new Date().toISOString(),
                dueDate: yesterday.toISOString(),
            };
            expect(isOverdue(todo)).toBe(true);
        });

        it('should return false for future due dates', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const todo: TodoItem = {
                id: 1, text: 'test', completed: false,
                createdAt: new Date().toISOString(),
                dueDate: tomorrow.toISOString(),
            };
            expect(isOverdue(todo)).toBe(false);
        });
    });

    describe('migrateTodoItem', () => {
        it('should add createdAt to old items', () => {
            const old = { id: 1, text: 'test', completed: false };
            const result = migrateTodoItem(old);
            expect(result.createdAt).toBeDefined();
        });

        it('should preserve existing fields', () => {
            const iso = '2026-01-01T00:00:00.000Z';
            const item = { id: 5, text: 'hello', completed: true, createdAt: iso };
            const result = migrateTodoItem(item);
            expect(result.id).toBe(5);
            expect(result.text).toBe('hello');
            expect(result.completed).toBe(true);
            expect(result.createdAt).toBe(iso);
        });
    });

    describe('lineThroughText', () => {
        it('should add strikethrough characters', () => {
            const result = lineThroughText('abc');
            expect(result).toContain('\u0336');
            expect(result.length).toBeGreaterThan(3);
        });
    });
});

// ── Processor tests ─────────────────────────────────────────

describe('CliTodoCommandProcessor', () => {
    let processor: CliTodoCommandProcessor;

    beforeEach(() => {
        if (typeof localStorage === 'undefined') {
            (window as any).localStorage = {
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {},
            };
        }
        spyOn(localStorage, 'getItem').and.returnValue(null);
        processor = new CliTodoCommandProcessor();
    });

    it('should be created', () => {
        expect(processor).toBeDefined();
    });

    describe('command identity', () => {
        it('should have command name "todo"', () => {
            expect(processor.command).toBe('todo');
        });

        it('should have a description', () => {
            expect(processor.description).toBeDefined();
            expect(processor.description!.length).toBeGreaterThan(0);
        });

        it('should have metadata with an icon', () => {
            expect(processor.metadata).toBeDefined();
            expect(processor.metadata!.icon).toBe('📝');
        });

        it('should have an author', () => {
            expect(processor.author).toBeDefined();
        });

        it('should have a version', () => {
            expect(processor.version).toBeDefined();
        });
    });

    describe('sub-processors', () => {
        it('should have exactly 6 sub-processors', () => {
            expect(processor.processors!.length).toBe(6);
        });

        const expectedCommands = ['ls', 'add', 'edit', 'done', 'toggle', 'rm'];

        expectedCommands.forEach((cmd) => {
            it(`should include "${cmd}" sub-processor`, () => {
                const sub = processor.processors!.find((p) => p.command === cmd);
                expect(sub).toBeDefined();
                expect(sub!.description).toBeDefined();
                expect(typeof sub!.processCommand).toBe('function');
            });
        });

        it('"done" should have alias "complete"', () => {
            const sub = processor.processors!.find((p) => p.command === 'done');
            expect(sub!.aliases).toContain('complete');
        });

        it('"ls" should have alias "list"', () => {
            const sub = processor.processors!.find((p) => p.command === 'ls');
            expect(sub!.aliases).toContain('list');
        });

        it('"rm" should have alias "remove"', () => {
            const sub = processor.processors!.find((p) => p.command === 'rm');
            expect(sub!.aliases).toContain('remove');
        });
    });

    describe('sub-processor configuration', () => {
        it('"add" should have valueRequired and acceptsRawInput', () => {
            const sub = processor.processors!.find((p) => p.command === 'add');
            expect(sub!.valueRequired).toBe(true);
            expect(sub!.acceptsRawInput).toBe(true);
        });

        it('"add" should have a "due" parameter', () => {
            const sub = processor.processors!.find((p) => p.command === 'add');
            const dueParam = sub!.parameters!.find((p) => p.name === 'due');
            expect(dueParam).toBeDefined();
            expect(dueParam!.type).toBe('string');
        });

        it('"edit" should have valueRequired and acceptsRawInput', () => {
            const sub = processor.processors!.find((p) => p.command === 'edit');
            expect(sub!.valueRequired).toBe(true);
            expect(sub!.acceptsRawInput).toBe(true);
        });

        it('"edit" should have a "due" parameter', () => {
            const sub = processor.processors!.find((p) => p.command === 'edit');
            const dueParam = sub!.parameters!.find((p) => p.name === 'due');
            expect(dueParam).toBeDefined();
        });

        it('"done" should have valueRequired and acceptsRawInput', () => {
            const sub = processor.processors!.find((p) => p.command === 'done');
            expect(sub!.valueRequired).toBe(true);
            expect(sub!.acceptsRawInput).toBe(true);
        });

        it('"toggle" should have valueRequired and acceptsRawInput', () => {
            const sub = processor.processors!.find((p) => p.command === 'toggle');
            expect(sub!.valueRequired).toBe(true);
            expect(sub!.acceptsRawInput).toBe(true);
        });

        it('"rm" should have an "all" parameter with alias "a"', () => {
            const sub = processor.processors!.find((p) => p.command === 'rm');
            const allParam = sub!.parameters!.find((p) => p.name === 'all');
            expect(allParam).toBeDefined();
            expect(allParam!.type).toBe('boolean');
            expect(allParam!.aliases).toContain('a');
        });

        it('"ls" should have pending, completed, and overdue parameters', () => {
            const sub = processor.processors!.find((p) => p.command === 'ls');
            expect(sub!.parameters!.find((p) => p.name === 'pending')).toBeDefined();
            expect(sub!.parameters!.find((p) => p.name === 'completed')).toBeDefined();
            expect(sub!.parameters!.find((p) => p.name === 'overdue')).toBeDefined();
        });
    });

    describe('stateConfiguration', () => {
        it('should have stateConfiguration with todos', () => {
            expect(processor.stateConfiguration).toBeDefined();
            expect(processor.stateConfiguration!.initialState['todos']).toBeDefined();
        });
    });

    describe('methods', () => {
        it('should have processCommand', () => {
            expect(typeof processor.processCommand).toBe('function');
        });

        it('should have writeDescription', () => {
            expect(typeof processor.writeDescription).toBe('function');
        });

        it('should have initialize', () => {
            expect(typeof processor.initialize).toBe('function');
        });

        it('should have getTodos', () => {
            expect(typeof processor.getTodos).toBe('function');
            expect(Array.isArray(processor.getTodos())).toBe(true);
        });
    });
});
```

**Step 2: Commit**

```bash
git add packages/plugins/todo/src/tests/index.spec.ts
git commit -m "test(todo): rewrite tests for enhanced todo plugin

Tests utilities (parseDueDate, formatRelativeDate, isOverdue,
migrateTodoItem, lineThroughText) and processor structure
(6 sub-commands, aliases, parameters, configuration)."
```

---

### Task 6: Update README

**Files:**
- Rewrite: `packages/plugins/todo/README.md`

**Step 1: Replace README**

````markdown
# @qodalis/cli-todo

A practical CLI task manager. Add, list, edit, complete, and remove tasks with due dates.

## Installation

```
packages add @qodalis/cli-todo
packages add todo
```

## Commands

```bash
# Add tasks
todo add Buy groceries
todo add Submit report --due tomorrow
todo add Call dentist --due friday
todo add Pay rent --due 2026-03-15

# List tasks
todo ls                    # all tasks with progress
todo ls --pending          # pending only
todo ls --completed        # completed only
todo ls --overdue          # overdue only

# Edit tasks
todo edit 3 Buy organic groceries
todo edit 3 --due next week
todo edit 3 New text --due monday
todo edit 3 --due none     # remove due date

# Complete tasks
todo done 1                # mark as done
todo toggle 2              # toggle done/undone

# Remove tasks
todo rm 3                  # remove by ID
todo rm --all              # remove all (with confirmation)
```

## Due Date Formats

| Format | Example |
|--------|---------|
| `today` | Due today |
| `tomorrow` | Due tomorrow |
| Day name | `monday`, `friday` (next occurrence) |
| `next week` | 7 days from now |
| `next month` | 1 month from now |
| `YYYY-MM-DD` | `2026-03-15` |

## Display

```
Todos (2/5 done)
  [ ] #1 - Buy groceries            due: tomorrow
  [x] #2 - Finish report            done
  [ ] #3 - Call dentist              overdue: 2 days ago
  [x] #4 - Send email               done
  [ ] #5 - Clean kitchen
```

Overdue tasks are highlighted in red. Completed tasks show strikethrough text.
````

**Step 2: Commit**

```bash
git add packages/plugins/todo/README.md
git commit -m "docs(todo): update README for enhanced todo plugin"
```

---

### Task 7: Build and run tests

**Step 1: Build**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && npx nx build todo`
Expected: Build succeeds

**Step 2: Run tests**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && npx nx test todo`
Expected: All tests pass

**Step 3: Clean up**

Run: `pkill -f "karma|ChromeHeadless" 2>/dev/null; true`

import {
    CliForegroundColor,
    CliIcon,
    CliProcessCommand,
    CliProcessorMetadata,
    CliStateConfiguration,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliConfigurationOption,
    ICliExecutionContext,
    getPluginConfigValue,
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

    configurationOptions?: ICliConfigurationOption[] = [
        {
            key: 'showCompletedFirst',
            label: 'Show Completed First',
            description: 'List completed tasks before pending ones',
            type: 'boolean',
            defaultValue: false,
        },
        {
            key: 'confirmBeforeDelete',
            label: 'Confirm Before Delete',
            description: 'Ask for confirmation before removing tasks',
            type: 'boolean',
            defaultValue: false,
        },
    ];

    stateConfiguration?: CliStateConfiguration = {
        initialState: {
            todos: this.loadFromOldStorage() ?? [],
        },
    };

    private todos: TodoItem[] = [];

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

                    const showCompletedFirst = getPluginConfigValue(context, 'todo', 'showCompletedFirst', false);
                    if (showCompletedFirst) {
                        filtered.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? -1 : 1));
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
                    const text = unquote(command.value ?? '');
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

                    // The id comes from the latest saved list: two tabs
                    // adding at once never get the same id
                    let newItem!: TodoItem;
                    await this.changeTodos(context, (todos) => {
                        newItem = {
                            id: nextIdOf(todos),
                            text,
                            completed: false,
                            createdAt: new Date().toISOString(),
                            dueDate,
                        };
                        todos.push(newItem);
                    });

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
                    const newText = spaceIndex === -1 ? undefined : unquote(raw.substring(spaceIndex + 1).trim());

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
                    const edit: Partial<TodoItem> = {};

                    if (newText) {
                        edit.text = newText;
                    }

                    if (dueArg) {
                        if (dueArg === 'none') {
                            edit.dueDate = undefined;
                        } else {
                            const parsed = parseDueDate(dueArg);
                            if (!parsed) {
                                context.writer.writeError(`Invalid due date: "${dueArg}".`);
                                return;
                            }
                            edit.dueDate = parsed;
                        }
                    }

                    if (Object.keys(edit).length === 0) {
                        context.writer.writeError('Nothing to update. Provide new text or --due.');
                        return;
                    }

                    let updated: TodoItem | undefined;
                    await this.changeTodos(context, (todos) => {
                        const item = todos.find((t) => t.id === id);
                        if (item) updated = Object.assign(item, edit);
                    });
                    context.writer.writeSuccess(`Updated task #${id}.`);
                    context.process.output(updated ?? { ...todo, ...edit });
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

                    const completedAt = new Date().toISOString();
                    await this.changeTodos(context, (todos) => {
                        const item = todos.find((t) => t.id === id);
                        if (item) {
                            item.completed = true;
                            item.completedAt = completedAt;
                        }
                    });
                    context.writer.writeSuccess(`Done: "${todo.text}"`);
                    context.process.output({ ...todo, completed: true, completedAt });
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

                    const completed = !todo.completed;
                    const completedAt = completed ? new Date().toISOString() : undefined;
                    await this.changeTodos(context, (todos) => {
                        const item = todos.find((t) => t.id === id);
                        if (item) {
                            item.completed = completed;
                            item.completedAt = completedAt;
                        }
                    });

                    const status = completed ? 'done' : 'reopened';
                    context.writer.writeSuccess(`Task #${id} marked as ${status}.`);
                    context.process.output({ ...todo, completed, completedAt });
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

                        const confirmed = await context.reader.readConfirm(
                            `Remove all ${this.todos.length} tasks?`,
                            false,
                        );

                        if (!confirmed) {
                            context.writer.writeInfo('Cancelled.');
                            return;
                        }

                        await this.changeTodos(context, () => []);
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

                    const confirmBeforeDelete = getPluginConfigValue(context, 'todo', 'confirmBeforeDelete', false);
                    if (confirmBeforeDelete) {
                        const confirmed = await context.reader.readConfirm(
                            `Remove task #${id}: "${this.todos[index].text}"?`,
                            false,
                        );
                        if (!confirmed) {
                            context.writer.writeInfo('Cancelled.');
                            return;
                        }
                    }

                    const removed = this.todos[index];
                    await this.changeTodos(context, (todos) =>
                        todos.filter((t) => t.id !== id),
                    );
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

    /**
     * Change the list and save it, atomically: `change` gets the latest saved
     * list (another tab may have changed it) to edit in place, or returns a
     * new one.
     */
    private async changeTodos(
        context: ICliExecutionContext,
        change: (todos: TodoItem[]) => TodoItem[] | void,
    ): Promise<void> {
        await context.state.update((state) => {
            const todos = ((state['todos'] as TodoItem[] | undefined) ?? []).map(
                (t) => ({ ...migrateTodoItem(t) }),
            );
            return { todos: change(todos) ?? todos };
        });
        localStorage.removeItem('todo-items');
    }
}

/** The id for a new task: one more than the highest. */
function nextIdOf(todos: TodoItem[]): number {
    return todos.length > 0 ? Math.max(...todos.map((t) => t.id)) + 1 : 1;
}

/** `"buy milk"` or `'buy milk'` without its quotes. */
function unquote(text: string): string {
    const t = text.trim();
    return t.length > 1 &&
        ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
        ? t.slice(1, -1)
        : t;
}

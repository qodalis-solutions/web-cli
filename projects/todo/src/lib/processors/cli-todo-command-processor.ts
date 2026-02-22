import { Injectable } from '@angular/core';
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

type TodoItem = { id: number; text: string; completed: boolean };

@Injectable()
export class CliTodoCommandProcessor implements ICliCommandProcessor {
    command = 'todo';

    description =
        'A command-line tool for managing your tasks efficiently. Add, list, complete, and remove TODO items with simple commands.';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        icon: '📝',
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {
            todos: this.loadFromOldStorage() ?? [],
        },
    };

    private todos: TodoItem[] = [];

    private nextId = 1;

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
        writer.writeln('📋 Commands:');
        writer.writeln(`  ${writer.wrapInColor('todo ls', CliForegroundColor.Cyan)}               📃 List all TODO items`);
        writer.writeln(`  ${writer.wrapInColor('todo add <text>', CliForegroundColor.Cyan)}        ➕ Add a new TODO item`);
        writer.writeln(`  ${writer.wrapInColor('todo rm <id>', CliForegroundColor.Cyan)}           🗑  Remove a TODO item by ID`);
        writer.writeln(`  ${writer.wrapInColor('todo rm --all', CliForegroundColor.Cyan)}          🗑  Remove all TODO items`);
        writer.writeln(`  ${writer.wrapInColor('todo complete <id>', CliForegroundColor.Cyan)}     ✔  Mark a TODO as completed`);
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(`  todo add Buy milk                ${writer.wrapInColor('# Add a new task', CliForegroundColor.Green)}`);
        writer.writeln(`  todo ls                          ${writer.wrapInColor('# View all tasks', CliForegroundColor.Green)}`);
        writer.writeln(`  todo complete 1                  ${writer.wrapInColor('# Mark task #1 done', CliForegroundColor.Green)}`);
        writer.writeln(`  todo rm 2                        ${writer.wrapInColor('# Delete task #2', CliForegroundColor.Green)}`);
    }

    async initialize(context: ICliExecutionContext): Promise<void> {
        context.state
            .select<TodoItem[]>((x) => x['todos'])
            .subscribe((todos) => {
                this.todos = todos;

                this.nextId =
                    this.todos.length > 0
                        ? Math.max(...this.todos.map((t) => t.id)) + 1
                        : 1;
            });
    }

    private lineThroughText(text: string): string {
        return text
            .split('')
            .map((char) => char + '\u0336')
            .join('');
    }

    private registerSubProcessors(): void {
        this.processors = [
            {
                command: 'ls',
                description: 'List all TODO items',
                processCommand: async (_, context) => {
                    if (this.todos.length === 0) {
                        context.writer.writeWarning('No TODO items found.');
                        context.writer.writeln(
                            'Use "todo add <text>" to add a new TODO item.',
                        );
                        context.process.output(JSON.stringify(this.todos));
                        return;
                    }
                    this.todos.forEach((todo) => {
                        context.writer.writeln(
                            `[${todo.completed ? context.writer.wrapInColor(CliIcon.CheckIcon, CliForegroundColor.Green) : ' '}] #${todo.id} - ${todo.text}`,
                        );
                    });

                    context.process.output(this.todos);
                },
            },
            {
                command: 'add',
                description: 'Add a new TODO item',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (command, context) => {
                    const text = command.value;
                    if (!text) {
                        context.writer.writeError(
                            'Please provide a TODO description.',
                        );
                        return;
                    }

                    const newItem = {
                        id: this.nextId++,
                        text,
                        completed: false,
                    };

                    this.todos.push(newItem);

                    await this.saveToStorage(context);

                    context.writer.writeSuccess(`Added TODO: "${text}"`);

                    context.process.output(newItem.id.toString());
                },
            },
            {
                command: 'rm',
                description: 'Remove a TODO item by ID',
                allowUnlistedCommands: true,
                parameters: [
                    {
                        name: 'all',
                        description: 'Remove all TODO items',
                        type: 'boolean',
                        defaultValue: false,
                        aliases: ['a'],
                        required: false,
                    },
                ],
                processCommand: async (command, context) => {
                    if (command.args['all'] || command.args['a']) {
                        this.todos = [];
                        await this.saveToStorage(context);
                        context.writer.writeSuccess('Removed all TODO items.');
                        return;
                    }

                    const id = parseInt(command.value!, 10);
                    if (isNaN(id)) {
                        context.writer.writeError(
                            'Please provide a valid TODO ID.',
                        );
                        return;
                    }
                    const index = this.todos.findIndex(
                        (todo) => todo.id === id,
                    );
                    if (index === -1) {
                        context.writer.writeInfo(
                            `TODO item with ID ${id} not found.`,
                        );
                        return;
                    }
                    this.todos.splice(index, 1);
                    await this.saveToStorage(context);
                    context.writer.writeSuccess(
                        `Removed TODO item with ID ${id}.`,
                    );
                },
            },
            {
                command: 'complete',
                description: 'Mark a TODO item as completed by ID',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (command, context) => {
                    const id = parseInt(command.value || '', 10);
                    if (isNaN(id)) {
                        context.writer.writeln(
                            'Please provide a valid TODO ID.',
                        );
                        return;
                    }
                    const todo = this.todos.find((todo) => todo.id === id);
                    if (!todo) {
                        context.writer.writeError(
                            `TODO item with ID ${id} not found.`,
                        );
                        return;
                    }

                    if (todo.completed) {
                        context.writer.writeInfo(
                            `TODO item with ID ${id} is already completed.`,
                        );
                        return;
                    }

                    todo.completed = true;
                    await this.saveToStorage(context);
                    context.writer.writeSuccess(
                        `Marked TODO item with ID ${id} as completed.`,
                    );
                },
            },
        ];
    }

    private loadFromOldStorage(): TodoItem[] {
        const data = localStorage.getItem('todo-items');
        return data ? JSON.parse(data) : [];
    }

    private async saveToStorage(context: ICliExecutionContext): Promise<void> {
        context.state.updateState({ todos: this.todos });

        await context.state.persist();
        localStorage.removeItem('todo-items');
    }
}

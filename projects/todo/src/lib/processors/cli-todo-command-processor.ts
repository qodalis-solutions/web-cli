import { Injectable } from '@angular/core';
import {
    CliForegroundColor,
    CliIcon,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

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

    private todos: { id: number; text: string; completed: boolean }[] = [];

    private nextId = 1;

    private storageKey = 'todo-items';

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
        context.writer.writeln(this.description!);
        context.writer.writeln();
        context.writer.writeln('Usage:');
        context.writer.writeln('  todo <command> [options]');
        context.writer.writeln();
        context.writer.writeln('Commands:');
        context.writer.writeln('  ls               List all TODO items');
        context.writer.writeln(
            '  add <text>       Add a new TODO item with the given text',
        );
        context.writer.writeln(
            '  rm <id>          Remove a TODO item by its ID',
        );
        context.writer.writeln(
            '  complete <id>    Mark a TODO item as completed by its ID',
        );
        context.writer.writeln();
        context.writer.writeln('Examples:');
        context.writer.writeln('  todo add Buy milk');
        context.writer.writeln('  todo ls');
        context.writer.writeln('  todo complete 1');
        context.writer.writeln('  todo rm 2');
        context.writer.writeln();
    }

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.todos = this.loadFromStorage();
        this.nextId =
            this.todos.length > 0
                ? Math.max(...this.todos.map((t) => t.id)) + 1
                : 1;
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
                            `[${todo.completed ? context.writer.wrapInColor(CliIcon.CheckIcon, CliForegroundColor.Green) : ' '}] #${todo.id} - ${todo.completed ? this.lineThroughText(todo.text) : todo.text}`,
                        );
                    });

                    context.process.output(JSON.stringify(this.todos));
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

                    this.saveToStorage();

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
                        this.saveToStorage();
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
                    this.saveToStorage();
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
                    todo.completed = true;
                    this.saveToStorage();
                    context.writer.writeSuccess(
                        `Marked TODO item with ID ${id} as completed.`,
                    );
                },
            },
        ];
    }

    private loadFromStorage(): {
        id: number;
        text: string;
        completed: boolean;
    }[] {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
    }

    private saveToStorage(): void {
        localStorage.setItem(this.storageKey, JSON.stringify(this.todos));
    }
}

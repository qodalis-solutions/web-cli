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

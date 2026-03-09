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
    translations: {
        es: { 'cli.todo.description': 'Gestionar tus tareas desde la terminal' },
        fr: { 'cli.todo.description': 'Gérer vos tâches depuis le terminal' },
        de: { 'cli.todo.description': 'Aufgaben über das Terminal verwalten' },
        pt: { 'cli.todo.description': 'Gerenciar suas tarefas pelo terminal' },
        it: { 'cli.todo.description': 'Gestire le attività dal terminale' },
        ja: { 'cli.todo.description': 'ターミナルからタスクを管理' },
        ko: { 'cli.todo.description': '터미널에서 할 일 관리' },
        zh: { 'cli.todo.description': '从终端管理你的任务' },
        ru: { 'cli.todo.description': 'Управление задачами из терминала' },
        ro: { 'cli.todo.description': 'Gestionează sarcinile tale din terminal' },
    },
};

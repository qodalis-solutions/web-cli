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

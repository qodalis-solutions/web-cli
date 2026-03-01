/*
 * Public API Surface of todo
 */

export * from './lib/processors/cli-todo-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliTodoCommandProcessor } from './lib/processors/cli-todo-command-processor';
import { API_VERSION } from './lib/version';

export const todoModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-todo',
    processors: [new CliTodoCommandProcessor()],
};

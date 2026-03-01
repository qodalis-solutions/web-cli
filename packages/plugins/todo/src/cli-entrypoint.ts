import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliTodoCommandProcessor } from './lib/processors/cli-todo-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-todo',
    processors: [new CliTodoCommandProcessor()],
};

bootCliModule(module);

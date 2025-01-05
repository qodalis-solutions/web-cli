import { bootUmdModule, ICliUmdModule } from '@qodalis/cli-core';
import { CliTodoCommandProcessor } from './lib/processors/cli-todo-command-processor';

const module: ICliUmdModule = {
    name: '@qodalis/cli-todo',
    processors: [new CliTodoCommandProcessor()],
};

bootUmdModule(module);

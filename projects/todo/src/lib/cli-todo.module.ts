import { NgModule } from '@angular/core';
import { resolveCommandProcessorProvider } from '@qodalis/angular-cli';
import { CliTodoCommandProcessor } from './processors/cli-todo-command-processor';

@NgModule({
    declarations: [],
    imports: [],
    exports: [],
    providers: [resolveCommandProcessorProvider(CliTodoCommandProcessor)],
})
export class CliTodoModule {}

import { NgModule } from '@angular/core';
import { resolveCommandProcessorProvider } from '@qodalis/angular-cli';
import { CliLogsCommandProcessor } from './processors/cli-logs-command-processor';

@NgModule({
    declarations: [],
    imports: [],
    exports: [],
    providers: [resolveCommandProcessorProvider(CliLogsCommandProcessor)],
})
export class CliServerLogsModule {}

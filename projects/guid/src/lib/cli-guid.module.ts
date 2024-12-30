import { NgModule } from '@angular/core';
import { CliGuidCommandProcessor } from './processors/cli-guid-command-processor';
import { resolveCommandProcessorProvider } from '@qodalis/angular-cli';

@NgModule({
    declarations: [],
    imports: [],
    exports: [],
    providers: [resolveCommandProcessorProvider(CliGuidCommandProcessor)],
})
export class CliGuidModule {}

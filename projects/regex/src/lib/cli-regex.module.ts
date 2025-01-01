import { NgModule } from '@angular/core';
import { resolveCommandProcessorProvider } from '@qodalis/angular-cli';
import { CliRegexCommandProcessor } from './processors/cli-regex-command-processor';

@NgModule({
    declarations: [],
    imports: [],
    exports: [],
    providers: [resolveCommandProcessorProvider(CliRegexCommandProcessor)],
})
export class CliRegexModule {}

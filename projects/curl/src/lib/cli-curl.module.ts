import { NgModule } from '@angular/core';
import { resolveCommandProcessorProvider } from '@qodalis/angular-cli';
import { CliCurlCommandProcessor } from './processors/cli-curl-command-processor';

@NgModule({
    declarations: [],
    imports: [],
    exports: [],
    providers: [resolveCommandProcessorProvider(CliCurlCommandProcessor)],
})
export class CliCurlModule {}

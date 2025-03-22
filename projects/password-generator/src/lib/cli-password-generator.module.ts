import { NgModule } from '@angular/core';
import { resolveCommandProcessorProvider } from '@qodalis/angular-cli';
import { CliPasswordGeneratorCommandProcessor } from './processors/cli-password-generator-command-processor';

@NgModule({
    declarations: [],
    imports: [],
    exports: [],
    providers: [resolveCommandProcessorProvider(CliPasswordGeneratorCommandProcessor)],
})
export class CliPasswordGeneratorModule {}

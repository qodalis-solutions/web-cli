import { NgModule } from '@angular/core';
import { resolveCommandProcessorProvider } from '@qodalis/angular-cli';
import { CliQrCommandProcessor } from './processors/cli-qr-command-processor';

@NgModule({
    declarations: [],
    imports: [],
    exports: [],
    providers: [resolveCommandProcessorProvider(CliQrCommandProcessor)],
})
export class CliQrModule {}

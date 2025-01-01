import { NgModule } from '@angular/core';
import { CliCookiesCommandProcessor } from './processors/cli-cookies-command-processor';
import { CliLocalStorageCommandProcessor } from './processors/cli-local-storage-command-processor';
import { resolveCommandProcessorProvider } from '@qodalis/angular-cli';

@NgModule({
    declarations: [],
    imports: [],
    exports: [],
    providers: [
        resolveCommandProcessorProvider(CliCookiesCommandProcessor),
        resolveCommandProcessorProvider(CliLocalStorageCommandProcessor),
    ],
})
export class CliBrowserStorageModule {}

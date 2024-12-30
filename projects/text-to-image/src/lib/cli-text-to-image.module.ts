import { NgModule } from '@angular/core';
import { resolveCommandProcessorProvider } from '@qodalis/angular-cli';
import { CliTextToImageCommandProcessor } from './processors/cli-text-to-image-command-processor';

@NgModule({
    declarations: [],
    imports: [],
    exports: [],
    providers: [
        resolveCommandProcessorProvider(CliTextToImageCommandProcessor),
    ],
})
export class CliTextToImageModule {}

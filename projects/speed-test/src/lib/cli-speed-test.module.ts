import { NgModule } from '@angular/core';
import { resolveCommandProcessorProvider } from '@qodalis/angular-cli';
import { CliSpeedTestCommandProcessor } from './processors/cli-speed-test-command-processor';

@NgModule({
    declarations: [],
    imports: [],
    exports: [],
    providers: [resolveCommandProcessorProvider(CliSpeedTestCommandProcessor)],
})
export class CliSpeedTestModule {}

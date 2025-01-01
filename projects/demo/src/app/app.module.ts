import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import {
    CliModule,
    ICliUsersStoreService_TOKEN,
    resolveCommandProcessorProvider,
} from '@qodalis/angular-cli';
import { CliDemoCommandProcessor } from './processors/cli-demo-command-processor';
import { CliCustomUsersStoreService } from './services/custom-users-store.service';
import { CliServerLogsModule } from '@qodalis/cli-server-logs';
import { CliGuidModule } from '@qodalis/cli-guid';
import { CliTextToImageModule } from '@qodalis/cli-text-to-image';
import { CliRegexModule } from '@qodalis/cli-regex';
import { CliSpeedTestModule } from '@qodalis/cli-speed-test';
import { CliBrowserStorageModule } from '@qodalis/cli-browser-storage';

@NgModule({
    declarations: [AppComponent],
    imports: [
        BrowserModule,
        CliModule,
        CliServerLogsModule,
        CliGuidModule,
        CliTextToImageModule,
        CliRegexModule,
        CliSpeedTestModule,
        CliBrowserStorageModule,
    ],
    providers: [
        {
            useClass: CliCustomUsersStoreService,
            provide: ICliUsersStoreService_TOKEN,
        },
        resolveCommandProcessorProvider(CliDemoCommandProcessor),
    ],
    bootstrap: [AppComponent],
})
export class AppModule {}

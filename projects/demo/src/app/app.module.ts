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

@NgModule({
    declarations: [AppComponent],
    imports: [BrowserModule, CliModule],
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

import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import {
    CliCanViewService,
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
import { CustomCliCanViewService } from './services/custom-cli-can-view.service';
import { CliStringModule } from '@qodalis/cli-string';
import { CliTodoModule } from '@qodalis/cli-todo';
import { CliCurlModule } from '@qodalis/cli-curl';
import { CliPasswordGeneratorModule } from '@qodalis/cli-password-generator';
import { CliQrModule } from '@qodalis/cli-qr';

@NgModule({
    declarations: [AppComponent],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        CliModule,
        CliServerLogsModule,
        CliGuidModule,
        CliTextToImageModule,
        CliRegexModule,
        CliSpeedTestModule,
        CliBrowserStorageModule,
        CliStringModule,
        CliTodoModule,
        CliCurlModule,
        CliPasswordGeneratorModule,
        CliQrModule,
    ],
    providers: [
        {
            useClass: CliCustomUsersStoreService,
            provide: ICliUsersStoreService_TOKEN,
        },
        {
            useClass: CustomCliCanViewService,
            provide: CliCanViewService,
        },
        resolveCommandProcessorProvider(CliDemoCommandProcessor),
    ],
    bootstrap: [AppComponent],
})
export class AppModule {}

import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { CliModule } from '@qodalis/angular-cli';

@NgModule({
    declarations: [AppComponent],
    imports: [BrowserModule, CliModule],
    providers: [],
    bootstrap: [AppComponent],
})
export class AppModule {}

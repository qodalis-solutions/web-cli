import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { TranslatePipe, provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { AppComponent } from './app.component';
import { CliModule } from '@qodalis/angular-cli';
import { AppRoutingModule } from './app-routing.module';

@NgModule({
    declarations: [AppComponent],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        HttpClientModule,
        CliModule,
        AppRoutingModule,
        TranslatePipe,
    ],
    providers: [
        provideTranslateService({
            fallbackLang: 'en',
            loader: provideTranslateHttpLoader({
                prefix: './assets/i18n/',
                suffix: '.json',
            }),
        }),
    ],
    bootstrap: [AppComponent],
})
export class AppModule {}

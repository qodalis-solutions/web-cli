import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslatePipe, provideTranslateService } from '@ngx-translate/core';
import { AppComponent } from './app.component';
import { CliModule } from '@qodalis/angular-cli';

describe('AppComponent', () => {
    beforeEach(() =>
        TestBed.configureTestingModule({
            declarations: [AppComponent],
            imports: [CliModule, RouterTestingModule, TranslatePipe],
            providers: [provideTranslateService()],
        }),
    );

    it('should create the app', () => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.componentInstance;
        expect(app).toBeTruthy();
    });

    it(`should have as title 'Qodalis CLI'`, () => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.componentInstance;
        expect(app.title).toEqual('Qodalis CLI');
    });
});

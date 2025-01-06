import { Component } from '@angular/core';
import { CliLogLevel, CliOptions } from '@qodalis/cli-core';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.sass'],
})
export class AppComponent {
    title = 'demo';

    options: CliOptions = {
        welcomeMessage: {
            show: 'daily',
        },
        usersModule: {
            enabled: true,
        },
        logLevel: CliLogLevel.DEBUG,
    };
}

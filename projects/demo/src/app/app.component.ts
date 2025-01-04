import { Component } from '@angular/core';
import { CliOptions } from '@qodalis/cli-core';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.sass'],
})
export class AppComponent {
    title = 'demo';

    options: CliOptions = {
        //hideUserName: true,
        // welcomeMessage:
        //     'Welcome to demo CLI' + '\n\rType "help" to get started',
        usersModule: {
            enabled: true,
        },
    };
}

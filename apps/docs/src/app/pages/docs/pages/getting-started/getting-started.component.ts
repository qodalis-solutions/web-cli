import { Component } from '@angular/core';
import { CliOptions, ICliModule } from '@qodalis/cli-core';
import { guidModule } from '@qodalis/cli-guid';
import { filesModule } from '@qodalis/cli-files';
import { todoModule } from '@qodalis/cli-todo';
import { stringModule } from '@qodalis/cli-string';

@Component({
    standalone: false,
    selector: 'docs-getting-started',
    templateUrl: './getting-started.component.html',
})
export class GettingStartedComponent {
    activeTab: 'angular' | 'react' | 'vue' = 'angular';

    tryItModules: ICliModule[] = [
        guidModule,
        filesModule,
        todoModule,
        stringModule,
    ];

    tryItOptions: CliOptions = {};
}

import { Component } from '@angular/core';

@Component({
    selector: 'docs-getting-started',
    templateUrl: './getting-started.component.html',
})
export class GettingStartedComponent {
    activeTab: 'angular' | 'react' | 'vue' = 'angular';
}

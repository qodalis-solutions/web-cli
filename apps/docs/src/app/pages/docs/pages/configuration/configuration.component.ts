import { Component } from '@angular/core';

@Component({
    standalone: false,
    selector: 'docs-configuration',
    templateUrl: './configuration.component.html',
})
export class ConfigurationComponent {
    activeTab: 'angular' | 'react' | 'vue' | 'vanilla' = 'angular';
}

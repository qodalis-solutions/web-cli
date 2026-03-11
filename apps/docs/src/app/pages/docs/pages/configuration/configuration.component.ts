import { Component } from '@angular/core';

@Component({
    selector: 'docs-configuration',
    templateUrl: './configuration.component.html',
})
export class ConfigurationComponent {
    activeTab: 'angular' | 'react' | 'vue' = 'angular';
}

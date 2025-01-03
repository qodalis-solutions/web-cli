import { Component, Input } from '@angular/core';

@Component({
    selector: 'collapsable-content',
    templateUrl: './collapsable-content.component.html',
    styleUrls: ['./collapsable-content.component.sass'],
})
export class CollapsableContentComponent {
    @Input() isCollapsed: boolean = true;

    toggleTerminal(): void {
        this.isCollapsed = !this.isCollapsed;
    }
}

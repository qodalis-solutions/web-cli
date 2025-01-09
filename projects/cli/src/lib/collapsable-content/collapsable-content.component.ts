import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'collapsable-content',
    templateUrl: './collapsable-content.component.html',
    styleUrls: ['./collapsable-content.component.sass'],
})
export class CollapsableContentComponent {
    @Input() isCollapsed: boolean = true;

    @Output()
    public onToggle = new EventEmitter<boolean>();

    toggleTerminal(): void {
        this.isCollapsed = !this.isCollapsed;

        this.onToggle.emit(this.isCollapsed);
    }
}

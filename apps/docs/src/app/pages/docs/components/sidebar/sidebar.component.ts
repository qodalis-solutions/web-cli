import { Component, EventEmitter, Output } from '@angular/core';
import { DOCS_NAV, NavItem } from '../../../../data/navigation';

@Component({
    selector: 'docs-sidebar',
    templateUrl: './sidebar.component.html',
    styleUrls: ['./sidebar.component.sass'],
})
export class SidebarComponent {
    @Output() linkClicked = new EventEmitter<void>();
    nav = DOCS_NAV;
    expandedSections: Set<string> = new Set([
        'Getting Started',
        'Core Concepts',
        'Plugins',
    ]);

    toggleSection(label: string): void {
        if (this.expandedSections.has(label)) {
            this.expandedSections.delete(label);
        } else {
            this.expandedSections.add(label);
        }
    }

    isExpanded(label: string): boolean {
        return this.expandedSections.has(label);
    }
}

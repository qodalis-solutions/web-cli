import { Component } from '@angular/core';

@Component({
    standalone: false,
    selector: 'docs-shell',
    templateUrl: './docs.component.html',
    styleUrls: ['./docs.component.sass'],
})
export class DocsComponent {
    sidebarOpen = false;
}

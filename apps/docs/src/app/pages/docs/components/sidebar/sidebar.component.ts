import { Component, DestroyRef, ElementRef, EventEmitter, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { DOCS_NAV } from '../../../../data/navigation';
import { LIBRARY_VERSION } from '@qodalis/cli-core';

@Component({
    standalone: false,
    selector: 'docs-sidebar',
    templateUrl: './sidebar.component.html',
    styleUrls: ['./sidebar.component.sass'],
})
export class SidebarComponent {
    @Output() linkClicked = new EventEmitter<void>();
    nav = DOCS_NAV;
    version = LIBRARY_VERSION;
    expandedSections: Set<string> = new Set(['sidebar.core-concepts']);

    private readonly router = inject(Router);
    private readonly host = inject(ElementRef<HTMLElement>);

    constructor() {
        // Open the section of the current page, also when it was reached from
        // a link in the content, and keep its entry in view
        this.router.events
            .pipe(
                filter((e) => e instanceof NavigationEnd),
                takeUntilDestroyed(inject(DestroyRef)),
            )
            .subscribe(() => this.revealCurrent());
        this.revealCurrent();
    }

    toggleSection(label: string): void {
        if (this.expandedSections.has(label)) {
            this.expandedSections.delete(label);
        } else {
            this.expandedSections.add(label);
        }
    }

    expand(label: string): void {
        this.expandedSections.add(label);
    }

    isExpanded(label: string): boolean {
        return this.expandedSections.has(label);
    }

    private revealCurrent(): void {
        const path = this.router.url.split(/[?#]/)[0];
        const section = this.nav.find(
            (s) => s.path === path || s.children?.some((c) => c.path === path),
        );
        if (section?.children) this.expand(section.label);
        setTimeout(() => {
            const active = this.host.nativeElement.querySelector('a.active') as HTMLElement | null;
            active?.scrollIntoView({ block: 'nearest' });
        });
    }
}

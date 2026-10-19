import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { filter, merge } from 'rxjs';
import { DOCS_NAV, NavItem } from '../../data/navigation';
import { PLUGINS } from '../../data/plugins';

const SITE_NAME = 'Qodalis CLI';

/** Sidebar label key of a docs path, from the navigation tree. */
function navLabel(path: string, items: NavItem[] = DOCS_NAV): string | undefined {
    for (const item of items) {
        if (item.path === path) return item.label;
        const child = item.children && navLabel(path, item.children);
        if (child) return child;
    }
    return undefined;
}

@Component({
    standalone: false,
    selector: 'docs-shell',
    templateUrl: './docs.component.html',
    styleUrls: ['./docs.component.sass'],
})
export class DocsComponent {
    sidebarOpen = false;

    private readonly router = inject(Router);
    private readonly title = inject(Title);
    private readonly translate = inject(TranslateService);

    constructor() {
        // Each page's <title> is written into its static HTML, which only a
        // full load reads: keep it in step when navigating inside the app
        merge(
            this.router.events.pipe(filter((e) => e instanceof NavigationEnd)),
            this.translate.onLangChange,
        )
            .pipe(takeUntilDestroyed(inject(DestroyRef)))
            .subscribe(() => this.updateTitle());
        this.updateTitle();
    }

    private updateTitle(): void {
        const path = this.router.url.split(/[?#]/)[0];
        const plugin = PLUGINS.find((p) => `/docs/plugins/${p.id}` === path);
        const label = navLabel(path);
        // Before the translations load, instant() returns the key itself
        const translated = label && this.translate.instant(label);
        const name = plugin
            ? `${plugin.name} plugin`
            : translated !== label && translated;
        if (name) {
            this.title.setTitle(`${name} — ${SITE_NAME}`);
        }
    }
}

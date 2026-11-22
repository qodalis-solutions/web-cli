import { Component } from '@angular/core';

/** Shown for docs URLs that match no page, with ways back in. */
@Component({
    standalone: false,
    selector: 'docs-not-found',
    template: `
        <h1>{{ 'docs.not-found.title' | translate }}</h1>
        <p>{{ 'docs.not-found.description' | translate }}</p>
        <div class="next-steps-grid">
            <a class="next-step-card" routerLink="/docs/getting-started">
                <span class="next-step-icon" aria-hidden="true">&#9654;</span>
                <span class="next-step-title">{{
                    'sidebar.getting-started' | translate
                }}</span>
            </a>
            <a class="next-step-card" routerLink="/docs/plugins">
                <span class="next-step-icon" aria-hidden="true">&#9638;</span>
                <span class="next-step-title">{{
                    'sidebar.plugins' | translate
                }}</span>
            </a>
            <a class="next-step-card" routerLink="/">
                <span class="next-step-icon" aria-hidden="true">&#8962;</span>
                <span class="next-step-title">{{
                    'docs.not-found.home' | translate
                }}</span>
            </a>
        </div>
    `,
})
export class NotFoundComponent {}

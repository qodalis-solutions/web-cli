import {
    Component,
    OnInit,
    OnDestroy,
    ElementRef,
    ChangeDetectorRef,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { CliOptions, ICliModule } from '@qodalis/cli-core';
import { guidModule } from '@qodalis/cli-guid';
import { filesModule } from '@qodalis/cli-files';
import { yesnoModule } from '@qodalis/cli-yesno';
import { todoModule } from '@qodalis/cli-todo';
import { stringModule } from '@qodalis/cli-string';

export interface TocEntry {
    id: string;
    label: string;
}

@Component({
    standalone: false,
    selector: 'docs-core-concepts',
    templateUrl: './core-concepts.component.html',
})
export class CoreConceptsComponent implements OnInit, OnDestroy {
    currentTopic = '';
    toc: TocEntry[] = [];
    private sub!: Subscription;

    tryItModules: ICliModule[] = [
        guidModule,
        filesModule,
        yesnoModule,
        todoModule,
        stringModule,
    ];

    tryItOptions: CliOptions = {};

    constructor(
        private route: ActivatedRoute,
        private elRef: ElementRef,
        private cdr: ChangeDetectorRef,
    ) {}

    ngOnInit(): void {
        this.sub = this.route.params.subscribe((params) => {
            this.currentTopic = params['topic'] || '';
            setTimeout(() => this.buildToc());
        });
    }

    ngOnDestroy(): void {
        this.sub.unsubscribe();
    }

    scrollTo(id: string): void {
        const el = this.elRef.nativeElement.querySelector(`#${id}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    private buildToc(): void {
        const headings =
            this.elRef.nativeElement.querySelectorAll('h2');
        this.toc = [];
        headings.forEach((h: HTMLElement) => {
            const id =
                h.id ||
                h.textContent!
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, '');
            h.id = id;
            this.toc.push({ id, label: h.textContent!.trim() });
        });
        this.cdr.detectChanges();
    }
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
    selector: 'docs-core-concepts',
    templateUrl: './core-concepts.component.html',
})
export class CoreConceptsComponent implements OnInit, OnDestroy {
    currentTopic = '';
    private sub!: Subscription;

    constructor(private route: ActivatedRoute) {}

    ngOnInit(): void {
        this.sub = this.route.params.subscribe((params) => {
            this.currentTopic = params['topic'] || '';
        });
    }

    ngOnDestroy(): void {
        this.sub.unsubscribe();
    }
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
    selector: 'docs-server-detail',
    templateUrl: './server-detail.component.html',
})
export class ServerDetailComponent implements OnInit, OnDestroy {
    server = '';
    private sub!: Subscription;

    constructor(private route: ActivatedRoute) {}

    ngOnInit(): void {
        this.sub = this.route.params.subscribe((params) => {
            this.server = params['server'] || '';
        });
    }

    ngOnDestroy(): void {
        this.sub.unsubscribe();
    }
}

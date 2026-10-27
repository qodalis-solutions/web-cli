import {
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    Inject,
    Input,
    OnDestroy,
    Optional,
    Output,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import {
    CliEngineSnapshot,
    ICliModule,
    ICliPingServerService,
} from '@qodalis/cli-core';
import { CliEngine, CliEngineOptions, createCliEngine } from '@qodalis/cli';
import {
    CliModule_TOKEN,
    ICliPingServerService_TOKEN,
} from './tokens';

@Component({
    standalone: false,
    selector: 'cli',
    template: `<div
        #terminal
        [style.height]="height || '100%'"
        style="width: 100%;"
    ></div>`,
    styles: [],
    encapsulation: ViewEncapsulation.None,
})
export class CliComponent implements AfterViewInit, OnDestroy {
    @Input() options?: CliEngineOptions;
    @Input() modules?: ICliModule[];
    @Input() height?: string;
    @Input() snapshot?: CliEngineSnapshot;

    @Output() engineReady = new EventEmitter<CliEngine>();

    @ViewChild('terminal', { static: true }) terminalDiv!: ElementRef;

    private engine?: CliEngine;

    constructor(
        @Optional()
        @Inject(CliModule_TOKEN)
        private readonly diModules: ICliModule[],
        @Optional()
        @Inject(ICliPingServerService_TOKEN)
        private readonly pingServerService: ICliPingServerService,
    ) {}

    ngAfterViewInit(): void {
        this.engine = createCliEngine(this.terminalDiv.nativeElement, {
            framework: 'Angular',
            options: this.options,
            snapshot: this.snapshot,
            // Bridge Angular DI services into the engine's service container.
            services: this.pingServerService ? { 'cli-ping-server-service': this.pingServerService } : undefined,
            modules: [...(this.diModules ?? []), ...(this.modules ?? [])],
        });

        this.engine.start().then(() => {
            this.engineReady.emit(this.engine!);
        });
    }

    ngOnDestroy(): void {
        this.engine?.destroy();
    }

    public focus(): void {
        this.engine?.focus();
    }

    public getEngine(): CliEngine | undefined {
        return this.engine;
    }
}

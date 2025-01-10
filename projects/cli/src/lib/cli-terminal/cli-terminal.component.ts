import {
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnDestroy,
    OnInit,
    Output,
    ViewChild,
} from '@angular/core';
import {
    ITerminalInitOnlyOptions,
    ITerminalOptions,
    Terminal,
} from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

@Component({
    selector: 'cli-terminal',
    templateUrl: './cli-terminal.component.html',
    styleUrls: ['./cli-terminal.component.sass'],
})
export class CliTerminalComponent implements OnInit, AfterViewInit, OnDestroy {
    @Input() options!: ITerminalOptions & ITerminalInitOnlyOptions;

    @Output() onTerminalReady = new EventEmitter<Terminal>();

    // xterm dependencies
    @ViewChild('terminal', { static: true }) terminalDiv!: ElementRef;
    private terminal!: Terminal;
    private fitAddon!: FitAddon;
    private resizeObserver!: ResizeObserver;

    constructor() {}

    ngOnInit(): void {
        this.initializeTerminal();
    }

    ngAfterViewInit(): void {
        this.handleResize();
    }

    private initializeTerminal(): void {
        this.terminal = new Terminal(this.options);

        this.fitAddon = new FitAddon();

        this.terminal.loadAddon(this.fitAddon);

        const webLinksAddon = new WebLinksAddon();
        this.terminal.loadAddon(webLinksAddon);

        this.terminal.open(this.terminalDiv.nativeElement);

        this.terminal.focus();

        this.onTerminalReady.emit(this.terminal);
    }

    private handleResize(): void {
        window.addEventListener('resize', () => {
            this.fitAddon.fit();
        });

        this.observeContainerSize();
    }

    private observeContainerSize(): void {
        this.resizeObserver = new ResizeObserver(() => {
            this.fitAddon.fit();
        });

        this.resizeObserver.observe(this.terminalDiv.nativeElement);
    }

    ngOnDestroy(): void {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        this.terminal?.dispose();
    }
}

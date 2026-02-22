import {
    Component,
    Inject,
    Injector,
    Input,
    OnDestroy,
    OnInit,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import {
    CliOptions,
    ICliUserSession,
    ICliUserSessionService,
} from '@qodalis/cli-core';
import { CliCommandExecutorService } from './services';
import { CliKeyValueStore } from './storage/cli-key-value-store';
import {
    ITerminalInitOnlyOptions,
    ITerminalOptions,
    Terminal,
} from '@xterm/xterm';
import { ICliUserSessionService_TOKEN } from './tokens';
import { CliExecutionContext } from './context';
import { CliBoot } from './services/system/cli-boot';
import { CliWelcomeMessageService } from './services/system/cli-welcome-message.service';
import { BehaviorSubject, combineLatest, filter, Subscription } from 'rxjs';
import { themes } from './processors/theme/types';
import { CliTerminalComponent, ContainerSize } from '../cli-terminal/cli-terminal.component';

@Component({
    selector: 'cli',
    templateUrl: './cli.component.html',
    styleUrls: ['./cli.component.sass'],
    encapsulation: ViewEncapsulation.None,
})
export class CliComponent implements OnInit, OnDestroy {
    @Input() options?: CliOptions;

    @Input() height?: ContainerSize;

    @ViewChild(CliTerminalComponent) private terminalComponent!: CliTerminalComponent;

    protected terminalOptions!: ITerminalOptions & ITerminalInitOnlyOptions;
    private terminal!: Terminal;

    private executionContext?: CliExecutionContext;
    private currentUserSession: ICliUserSession | undefined;

    protected minDepsInitialized = new BehaviorSubject<boolean>(false);
    protected terminalInitialized = new BehaviorSubject<boolean>(false);

    private subscriptions = new Subscription();

    constructor(
        private injector: Injector,
        @Inject(ICliUserSessionService_TOKEN)
        private readonly userManagementService: ICliUserSessionService,
        private commandExecutor: CliCommandExecutorService,
        private readonly store: CliKeyValueStore,
    ) {
        this.subscriptions.add(
            this.userManagementService
                .getUserSession()
                .subscribe((session) => {
                    this.currentUserSession = session;
                    this.executionContext?.setSession(session!);

                    if (this.terminal) {
                        this.executionContext?.showPrompt({
                            reset: true,
                        });
                    }
                }),
        );
    }

    ngOnInit(): void {
        this.subscriptions.add(
            combineLatest([this.minDepsInitialized, this.terminalInitialized])
                .pipe(filter(([x, y]) => x && y))
                .subscribe(() => {
                    this.initialize();
                }),
        );

        this.terminalOptions = {
            cursorBlink: true,
            allowProposedApi: true,
            fontSize: 20,
            theme: themes.default,
            convertEol: true,
            ...(this.options?.terminalOptions ?? {}),
        };

        this.store.initialize().then(() => {
            this.minDepsInitialized.next(true);
        });
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
    }

    public focus(): void {
        this.terminalComponent?.fitTerminal();
    }

    protected onTerminalReady(terminal: Terminal): void {
        this.terminal = terminal;

        this.terminalInitialized.next(true);
    }

    private initialize() {
        this.executionContext = new CliExecutionContext(
            this.injector,
            this.terminal,
            this.commandExecutor,
            {
                ...(this.options ?? {}),
                terminalOptions: this.terminalOptions,
            },
        );

        this.executionContext.setSession(this.currentUserSession!);
        this.executionContext.initializeTerminalListeners();

        this.injector
            .get(CliBoot)
            .boot(this.executionContext)
            .then(() => {
                this.injector
                    .get(CliWelcomeMessageService)
                    .displayWelcomeMessage(this.executionContext!);
            });
    }
}

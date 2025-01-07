import { Terminal } from '@xterm/xterm';
import { Subject } from 'rxjs';
import {
    ICliExecutionContext,
    ICliTerminalWriter,
    ICliUserSession,
    CliOptions,
    ICliSpinner,
    ICliPercentageProgressBar,
    ICliCommandDataStore,
    ICliClipboard,
    ICliExecutionProcess,
    ICliCommandProcessor,
    ICliLogger,
    CliLogLevel,
    ICliContextServices,
} from '@qodalis/cli-core';
import { CliCommandExecutorService } from './cli-command-executor.service';
import { CliTerminalWriter } from './cli-terminal-writer';
import { CliTerminalSpinner } from './progress-bars/cli-terminal-spinner';
import { CliTerminalProgressBar } from './progress-bars/cli-terminal-progress-bar';
import { CliCommandDataStore } from './cli-command-data-store';
import { CliClipboard } from './cli-clipboard';
import { CliExecutionProcess } from './cli-execution-process';
import { Injector } from '@angular/core';
import { CliLogger_TOKEN } from '../tokens';
import { CliContextServices } from './system/cli-context-services';

export class CliExecutionContext implements ICliExecutionContext {
    public userSession?: ICliUserSession;

    public contextProcessor?: ICliCommandProcessor;

    public readonly writer: ICliTerminalWriter;

    public readonly spinner: ICliSpinner;

    public readonly progressBar: ICliPercentageProgressBar;

    public readonly options?: CliOptions;

    public readonly onAbort = new Subject<void>();

    public readonly dataStore: ICliCommandDataStore;

    public readonly clipboard: ICliClipboard;

    public readonly process: ICliExecutionProcess;

    public readonly logger: ICliLogger;

    public readonly services: ICliContextServices;

    constructor(
        injector: Injector,
        public terminal: Terminal,
        public executor: CliCommandExecutorService,
        public showPrompt: (options?: {
            reset?: boolean;
            newLine?: boolean;
        }) => void,
        cliOptions?: CliOptions,
    ) {
        //initialize services
        this.services = injector.get(CliContextServices);

        this.options = cliOptions;
        this.writer = new CliTerminalWriter(terminal);
        this.dataStore = new CliCommandDataStore(this);
        this.spinner = new CliTerminalSpinner(terminal);
        this.progressBar = new CliTerminalProgressBar(terminal);
        this.clipboard = new CliClipboard(this);
        this.process = new CliExecutionProcess(this);

        this.logger = injector.get(CliLogger_TOKEN);
        this.logger.setCliLogLevel(cliOptions?.logLevel || CliLogLevel.ERROR);

        this.services.set({
            provide: 'logger',
            useValue: this.logger,
        });
    }

    setContextProcessor(
        processor: ICliCommandProcessor | undefined,
        silent?: boolean,
    ): void {
        if (!processor) {
            this.contextProcessor = processor;

            return;
        }

        if (!silent) {
            this.writer.writeInfo(
                'Set ' +
                    processor?.command +
                    ' as context processor, press Ctrl+C to exit',
            );
        }

        this.contextProcessor = processor;
    }

    /**
     * Checks if there is a progress running
     * @returns true if there is a progress running
     * @returns false if there is no progress running
     */
    public isProgressRunning(): boolean {
        return this.progressBar.isRunning || this.spinner.isRunning;
    }

    /**
     * Aborts the current command
     */
    public abort(): void {
        this.onAbort.next();
    }

    public setSession(session: ICliUserSession): void {
        this.userSession = session;
    }
}

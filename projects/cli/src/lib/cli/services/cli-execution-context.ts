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
} from '@qodalis/cli-core';
import { CliCommandExecutorService } from './cli-command-executor.service';
import { CliTerminalWriter } from './cli-terminal-writer';
import { CliTerminalSpinner } from './cli-terminal-spinner';
import { CliTerminalProgressBar } from './cli-terminal-progress-bar';
import { CliCommandDataStore } from './cli-command-data-store';
import { CliClipboard } from './cli-clipboard';

export class CliExecutionContext implements ICliExecutionContext {
    public userSession?: ICliUserSession;

    public readonly writer: ICliTerminalWriter;

    public readonly spinner: ICliSpinner;

    public readonly progressBar: ICliPercentageProgressBar;

    public readonly options?: CliOptions;

    public readonly onAbort = new Subject<void>();

    public readonly dataStore: ICliCommandDataStore;

    public readonly clipboard: ICliClipboard;

    constructor(
        public terminal: Terminal,
        public executor: CliCommandExecutorService,
        public showPrompt: () => void,
        cliOptions?: CliOptions,
    ) {
        this.options = cliOptions;
        this.writer = new CliTerminalWriter(terminal);
        this.dataStore = new CliCommandDataStore(this);
        this.spinner = new CliTerminalSpinner(terminal);
        this.progressBar = new CliTerminalProgressBar(terminal);
        this.clipboard = new CliClipboard(this);
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

import { Terminal } from '@xterm/xterm';
import { Subject } from 'rxjs';
import {
    ICliExecutionContext,
    ICliTerminalWriter,
    ICliUserSession,
    CliOptions,
    ICliSpinner,
    ICliPercentageProgressBar,
} from '../models';
import { CliCommandExecutorService } from './cli-command-executor.service';
import { CliTerminalWriter } from './cli-terminal-writer';
import { CliTerminalSpinner } from './cli-terminal-spinner';
import { CliTerminalProgressBar } from './cli-terminal-progress-bar';

export class CliExecutionContext implements ICliExecutionContext {
    public data: Record<string, Record<string, any>> = {};

    public userSession?: ICliUserSession;

    public writer: ICliTerminalWriter;

    public spinner: ICliSpinner;
    public progressBar: ICliPercentageProgressBar;

    public cliOptions?: CliOptions;

    public onAbort = new Subject<void>();

    constructor(
        public terminal: Terminal,
        public executor: CliCommandExecutorService,
        public showPrompt: () => void,
        cliOptions?: CliOptions,
    ) {
        this.cliOptions = cliOptions;
        this.writer = new CliTerminalWriter(terminal);
        this.spinner = new CliTerminalSpinner(terminal);
        this.progressBar = new CliTerminalProgressBar(terminal);
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

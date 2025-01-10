import {
    CliOptions,
    ICliClipboard,
    ICliCommandExecutorService,
    ICliCommandProcessor,
    ICliServiceProvider,
    ICliExecutionContext,
    ICliExecutionProcess,
    ICliLogger,
    ICliPercentageProgressBar,
    ICliSpinner,
    ICliStateStore,
    ICliTerminalWriter,
    ICliUserSession,
    ICliTextAnimator,
} from '@qodalis/cli-core';
import { Terminal } from '@xterm/xterm';
import { Subject } from 'rxjs';
import { CliExecutionContext } from './cli-execution-context';
import { CliStateStoreManager } from '../state/cli-state-store-manager';

export class CliCommandExecutionContext implements ICliExecutionContext {
    userSession?: ICliUserSession | undefined;
    spinner?: ICliSpinner | undefined;
    progressBar: ICliPercentageProgressBar;
    textAnimator?: ICliTextAnimator | undefined;
    onAbort: Subject<void>;
    terminal: Terminal;
    writer: ICliTerminalWriter;
    executor: ICliCommandExecutorService;
    clipboard: ICliClipboard;
    state: ICliStateStore;
    options?: CliOptions | undefined;
    showPrompt: () => void;
    setContextProcessor: (
        processor: ICliCommandProcessor,
        silent?: boolean,
    ) => void;
    process: ICliExecutionProcess;
    logger: ICliLogger;
    services: ICliServiceProvider;

    constructor(
        public readonly context: CliExecutionContext,
        processor: ICliCommandProcessor,
    ) {
        this.userSession = context.userSession;
        this.spinner = context.spinner;
        this.progressBar = context.progressBar;
        this.textAnimator = context.textAnimator;
        this.onAbort = context.onAbort;
        this.terminal = context.terminal;
        this.writer = context.writer;
        this.executor = context.executor;
        this.clipboard = context.clipboard;
        this.options = context.options;
        this.showPrompt = context.showPrompt;
        this.setContextProcessor = context.setContextProcessor;
        this.process = context.process;
        this.logger = context.logger;
        this.services = context.services;

        this.state = context.services
            .get<CliStateStoreManager>(CliStateStoreManager)
            .getProcessorStateStore(processor);
    }
}

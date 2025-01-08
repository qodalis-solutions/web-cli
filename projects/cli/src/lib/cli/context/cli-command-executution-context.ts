import {
    CliOptions,
    ICliClipboard,
    ICliCommandExecutorService,
    ICliCommandProcessor,
    ICliContextServices,
    ICliExecutionContext,
    ICliExecutionProcess,
    ICliLogger,
    ICliPercentageProgressBar,
    ICliSpinner,
    ICliStateStore,
    ICliTerminalWriter,
    ICliUserSession,
} from '@qodalis/cli-core';
import { Terminal } from '@xterm/xterm';
import { Subject } from 'rxjs';
import { CliExecutionContext } from './cli-execution-context';

export class CliCommandExecutionContext implements ICliExecutionContext {
    userSession?: ICliUserSession | undefined;
    spinner?: ICliSpinner | undefined;
    progressBar: ICliPercentageProgressBar;
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
    services: ICliContextServices;

    constructor(
        public readonly context: CliExecutionContext,
        processor: ICliCommandProcessor,
    ) {
        this.userSession = context.userSession;
        this.spinner = context.spinner;
        this.progressBar = context.progressBar;
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

        this.state =
            context.stateStoreManager.getProcessorStateStore(processor);
    }
}

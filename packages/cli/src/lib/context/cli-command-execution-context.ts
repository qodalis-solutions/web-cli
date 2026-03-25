import {
    CliOptions,
    ICliClipboard,
    ICliCommandExecutorService,
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
    ICliServiceProvider,
    ICliExecutionContext,
    ICliExecutionProcess,
    ICliLogger,
    ICliInputReader,
    ICliManagedInterval,
    ICliManagedTimer,
    ICliPercentageProgressBar,
    ICliSpinner,
    ICliStateStore,
    ICliTerminalWriter,
    ICliUserSession,
    ICliTextAnimator,
    ICliBackgroundServiceRegistry,
    ICliTranslationService,
    CliFullScreenOptions,
} from '@qodalis/cli-core';
import { Terminal } from '@xterm/xterm';
import { Subject } from 'rxjs';
import {
    CliProcessorsRegistry_TOKEN,
    CliStateStoreManager_TOKEN,
} from '../tokens';
import { ICliStateStoreManager } from '../state/cli-state-store-manager';

export class CliCommandExecutionContext implements ICliExecutionContext {
    userSession?: ICliUserSession | undefined;
    spinner?: ICliSpinner | undefined;
    progressBar: ICliPercentageProgressBar;
    textAnimator?: ICliTextAnimator | undefined;
    onAbort: Subject<void>;
    signal?: AbortSignal;
    terminal: Terminal;
    writer: ICliTerminalWriter;
    executor: ICliCommandExecutorService;
    clipboard: ICliClipboard;
    state: ICliStateStore;
    options?: CliOptions | undefined;
    setContextProcessor: (
        processor: ICliCommandProcessor | undefined,
        silent?: boolean,
        fullScreen?: boolean,
    ) => void;
    process: ICliExecutionProcess;
    logger: ICliLogger;
    services: ICliServiceProvider;
    translator: ICliTranslationService;
    reader: ICliInputReader;
    readonly backgroundServices: ICliBackgroundServiceRegistry;

    get statusText(): string | undefined {
        return this.context.statusText;
    }
    set statusText(value: string | undefined) {
        this.context.statusText = value;
    }

    get promptLength(): number {
        return this.context.promptLength;
    }
    set promptLength(value: number) {
        this.context.promptLength = value;
    }

    get currentLine(): string {
        return this.context.currentLine;
    }

    setCurrentLine = (line: string): void => {
        this.context.setCurrentLine(line);
    };

    get cursorPosition(): number {
        return this.context.cursorPosition;
    }
    set cursorPosition(value: number) {
        this.context.cursorPosition = value;
    }

    clearLine: () => void;
    showPrompt: (options?: {
        reset?: boolean;
        newLine?: boolean;
        keepCurrentLine?: boolean;
    }) => void;
    clearCurrentLine: () => void;
    refreshCurrentLine: () => void;
    enterFullScreenMode: (processor: ICliCommandProcessor) => void;
    exitFullScreenMode: () => void;
    createInterval: (callback: () => void, ms: number) => ICliManagedInterval;
    createTimeout: (callback: () => void, ms: number) => ICliManagedTimer;
    submitCommand: (command: string) => Promise<void>;

    constructor(
        public readonly context: ICliExecutionContext,
        processor: ICliCommandProcessor,
    ) {
        this.userSession = context.userSession;
        this.spinner = context.spinner;
        this.progressBar = context.progressBar;
        this.textAnimator = context.textAnimator;
        this.onAbort = context.onAbort;
        this.signal = context.signal;
        this.terminal = context.terminal;
        this.writer = context.writer;
        this.executor = context.executor;
        this.clipboard = context.clipboard;
        this.options = context.options;
        this.setContextProcessor = context.setContextProcessor;
        this.clearLine = () => context.clearLine();
        this.showPrompt = (options) => context.showPrompt(options);
        this.clearCurrentLine = () => context.clearCurrentLine();
        this.refreshCurrentLine = () => context.refreshCurrentLine();
        this.process = context.process;
        this.logger = context.logger;
        this.services = context.services;
        this.translator = context.translator;
        this.reader = context.reader;

        this.enterFullScreenMode = (p: ICliCommandProcessor, o?: CliFullScreenOptions) =>
            context.enterFullScreenMode(p, o);
        this.exitFullScreenMode = () => context.exitFullScreenMode();
        this.submitCommand = (command: string) => context.submitCommand(command);
        this.createInterval = (cb, ms) => context.createInterval(cb, ms);
        this.createTimeout = (cb, ms) => context.createTimeout(cb, ms);
        this.backgroundServices = context.backgroundServices;

        this.state = context.services
            .get<ICliStateStoreManager>(CliStateStoreManager_TOKEN)
            .getProcessorStateStore(processor);
    }
}

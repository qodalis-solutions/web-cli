import { Terminal } from '@xterm/xterm';
import { Subject } from 'rxjs';
import {
    ICliExecutionContext,
    ICliManagedInterval,
    ICliManagedTimer,
    ICliTerminalWriter,
    ICliUserSession,
    CliOptions,
    ICliSpinner,
    ICliPercentageProgressBar,
    ICliClipboard,
    ICliExecutionProcess,
    ICliCommandProcessor,
    ICliLogger,
    CliLogLevel,
    ICliServiceProvider,
    ICliStateStore,
    ICliTextAnimator,
    ICliCommandExecutorService,
    ICliInputReader,
    ICliBackgroundServiceRegistry,
    ICliTranslationService,
    ICliFilePickerProvider,
    CliFullScreenOptions,
    ICliHttpClient,
    ICliNotifier,
    ICliEventBus,
    ICliEventBus_TOKEN,
} from '@qodalis/cli-core';
import { CliBackgroundServiceRegistry } from '../services/background';
import { CliHttpClient } from '../services/cli-http-client';
import { CliNotifier } from '../services/cli-notifier';
import { CliFullScreenManager } from './cli-fullscreen-manager';
import { CliTimerManager } from './cli-timer-manager';
import { CliTerminalWriter } from '../services/cli-terminal-writer';
import { CliTerminalSpinner } from '../services/progress-bars/cli-terminal-spinner';
import { CliTerminalProgressBar } from '../services/progress-bars/cli-terminal-progress-bar';
import { CliTerminalTextAnimator } from '../services/progress-bars/cli-terminal-text-animator';
import { CliClipboard } from '../services/cli-clipboard';
import { CliCommandHistory } from '../services/cli-command-history';
import { CliExecutionProcess } from './cli-execution-process';
import { CliStateStoreManager } from '../state/cli-state-store-manager';
import { CliInputReader } from '../services/cli-input-reader';
import {
    BrowserFilePickerProvider,
    NoopFilePickerProvider,
} from '../services/file-picker';
import { CliCompletionEngine } from '../completion/cli-completion-engine';
import {
    CliLineBuffer,
    IInputMode,
    InputModeHost,
    CommandLineMode,
    CommandLineModeHost,
    RawMode,
    CliTerminalLineRenderer,
    PromptOptions,
} from '../input';

export interface CliExecutionContextDeps {
    services: ICliServiceProvider;
    logger: ICliLogger;
    commandHistory: CliCommandHistory;
    stateStoreManager: CliStateStoreManager;
    translator: ICliTranslationService;
}

export class CliExecutionContext
    implements ICliExecutionContext, InputModeHost, CommandLineModeHost
{
    private _userSession?: ICliUserSession;

    /** The signed-in user; changing it emits `session:changed`. */
    public get userSession(): ICliUserSession | undefined {
        return this._userSession;
    }

    public set userSession(session: ICliUserSession | undefined) {
        const previous = this._userSession?.user?.name;
        this._userSession = session;
        if (session?.user?.name !== previous) {
            this.events?.emit('session:changed', { user: session?.user?.name });
        }
    }

    /** The terminal's event bus. */
    public readonly events?: ICliEventBus;

    public contextProcessor?: ICliCommandProcessor;

    public readonly writer: ICliTerminalWriter;

    public readonly spinner: ICliSpinner;

    public readonly textAnimator: ICliTextAnimator;

    public readonly progressBar: ICliPercentageProgressBar;

    public readonly options?: CliOptions;

    public readonly onAbort = new Subject<void>();

    public readonly state: ICliStateStore;

    public readonly clipboard: ICliClipboard;

    public readonly process: ICliExecutionProcess;

    public readonly logger: ICliLogger;

    public readonly services: ICliServiceProvider;

    public readonly translator: ICliTranslationService;

    public readonly backgroundServices: ICliBackgroundServiceRegistry;

    public http: ICliHttpClient;

    public readonly notifier: ICliNotifier;

    public promptPathProvider?: () => string | null;

    public readonly completionEngine = new CliCompletionEngine();

    public promptLength: number = 0;

    public readonly reader: ICliInputReader;

    /**
     * Result of the most recently executed command.
     * Updated by the command executor after each command completes.
     */
    public lastCommandResult?: { command: string; success: boolean };

    /**
     * Whether a command is currently being executed.
     * Set by the command executor at start/end of executeCommand().
     */
    public isExecuting = false;

    public readonly lineBuffer = new CliLineBuffer();

    public readonly lineRenderer: CliTerminalLineRenderer;

    public readonly commandHistory: CliCommandHistory;

    public readonly filePickerProvider: ICliFilePickerProvider;

    private readonly modeStack: IInputMode[] = [];

    /** Command-line input typed while booting; `null` when not holding. */
    private heldInput: string[] | null = null;
    private releaseHeldInputAtPrompt = false;
    private _typedDuringBoot = false;

    private readonly stateStoreManager: CliStateStoreManager;

    private readonly timerManager = new CliTimerManager();

    private readonly fullScreenManager: CliFullScreenManager;

    private windowKeydownListener?: (e: KeyboardEvent) => void;

    constructor(
        deps: CliExecutionContextDeps,
        public terminal: Terminal,
        public executor: ICliCommandExecutorService,
        cliOptions?: CliOptions,
    ) {
        //initialize services
        this.services = deps.services;
        this.events = deps.services.get<ICliEventBus>(ICliEventBus_TOKEN);
        this.translator = deps.translator;

        //initialize state store
        this.stateStoreManager = deps.stateStoreManager;
        this.state = this.stateStoreManager.getStateStore('shared');

        this.options = cliOptions;
        this.writer = new CliTerminalWriter(terminal);

        const spinner = new CliTerminalSpinner(terminal);
        const progressBar = new CliTerminalProgressBar(terminal);
        const textAnimator = new CliTerminalTextAnimator(terminal);

        spinner.context = this;
        progressBar.context = this;
        textAnimator.context = this;

        this.spinner = spinner;
        this.progressBar = progressBar;
        this.textAnimator = textAnimator;

        this.clipboard = new CliClipboard(this);
        this.process = new CliExecutionProcess(this);

        this.filePickerProvider =
            typeof document !== 'undefined'
                ? new BrowserFilePickerProvider()
                : new NoopFilePickerProvider();

        this.reader = new CliInputReader(this);

        //initialize logger
        this.logger = deps.logger;
        this.logger.setCliLogLevel(cliOptions?.logLevel || CliLogLevel.ERROR);

        this.commandHistory = deps.commandHistory;
        this.lineRenderer = new CliTerminalLineRenderer(terminal, this.writer);

        this.http = new CliHttpClient();
        this.notifier = new CliNotifier();

        this.backgroundServices = new CliBackgroundServiceRegistry(
            this.state,
            deps.services,
            this.writer,
        );

        this.fullScreenManager = new CliFullScreenManager(
            terminal,
            this.backgroundServices as CliBackgroundServiceRegistry,
        );
    }

    // -- Public API (ICliExecutionContext) --

    public writeToTerminal(text: string): void {
        this.terminal.write(text);
    }

    public getTerminalRows(): number {
        return this.terminal.rows;
    }

    public getTerminalCols(): number {
        return this.terminal.cols;
    }

    public get currentLine(): string {
        return this.lineBuffer.text;
    }

    public get cursorPosition(): number {
        return this.lineBuffer.cursorPosition;
    }

    public set cursorPosition(value: number) {
        this.lineBuffer.cursorPosition = value;
    }

    initializeTerminalListeners(): void {
        // Push CommandLineMode as the base mode
        const commandLineMode = new CommandLineMode(this);
        this.pushMode(commandLineMode);

        this.terminal.onData(async (data) => {
            // While booting, keep what the user types at the command line and
            // replay it at the first prompt. Prompts shown during boot (module
            // setup) push their own input mode and still read input directly.
            if (this.heldInput && this.modeStack.length === 1) {
                this.heldInput.push(data);
                return;
            }
            await this.handleTerminalData(data);
        });

        this.terminal.onKey(async (_event) => {});

        this.terminal.attachCustomKeyEventHandler((event) => {
            if (event.type === 'keydown') {
                const mode = this.currentMode;
                if (mode) {
                    return mode.handleKeyEvent(event);
                }
            }
            return true;
        });

        this.initializeWindowListeners();
    }

    private async handleTerminalData(data: string): Promise<void> {
        // A decorative animation (the welcome greeting) must not swallow
        // what the user types: stop it and handle the key normally.
        if (
            this.textAnimator.isRunning &&
            !this.progressBar.isRunning &&
            !this.spinner.isRunning
        ) {
            this.textAnimator.cancel?.();
        }
        if (this.isProgressRunning()) {
            return;
        }
        const mode = this.currentMode;
        if (mode) {
            await mode.handleInput(data);
        }
    }

    private _isBooted = false;

    /** `true` once boot has completed and the terminal is ready. */
    get isBooted(): boolean {
        return this._isBooted;
    }

    /** Called by the engine when boot has completed. */
    markBooted(): void {
        this._isBooted = true;
    }

    /** Start keeping command-line input instead of handling it (boot). */
    holdInput(): void {
        this.heldInput ??= [];
    }

    /**
     * Stop holding input: what was typed is replayed at the next prompt, or
     * right away when `immediately` is set (e.g. no prompt will be drawn).
     */
    releaseInput(immediately = false): void {
        if (!this.heldInput) return;
        if (immediately) {
            this.replayHeldInput();
        } else {
            this.releaseHeldInputAtPrompt = true;
        }
    }

    /** Whether a prompt (readLine, readSelect, ...) or full-screen mode owns the input. */
    get isReadingInput(): boolean {
        return this.modeStack.length > 1;
    }

    /** Whether keys were typed while input was held (boot). */
    get typedDuringBoot(): boolean {
        return this._typedDuringBoot || (this.heldInput?.length ?? 0) > 0;
    }

    private replayHeldInput(): void {
        const queued = this.heldInput ?? [];
        this.heldInput = null;
        this.releaseHeldInputAtPrompt = false;
        if (queued.length === 0) return;
        this._typedDuringBoot = true;
        void (async () => {
            for (const data of queued) {
                await this.handleTerminalData(data);
            }
        })();
    }

    private initializeWindowListeners(): void {
        // Window-level capture listener to intercept browser shortcuts that
        // conflict with terminal keybindings when the terminal has focus.
        // Note: Ctrl+W cannot be intercepted (browser closes tab before JS runs).
        const termEl = this.terminal.element;
        if (termEl) {
            this.windowKeydownListener = (event: KeyboardEvent) => {
                if (!termEl.contains(document.activeElement)) return;
                if (event.ctrlKey && !event.altKey && !event.metaKey) {
                    const key = event.key.toLowerCase();
                    if (
                        [
                            'f',
                            's',
                            'q',
                            'o',
                            'k',
                            'u',
                            'g',
                            'r',
                            'n',
                            'h',
                        ].includes(key)
                    ) {
                        event.preventDefault();
                    }
                }
            };
            window.addEventListener(
                'keydown',
                this.windowKeydownListener,
                true,
            );
        }
    }

    setContextProcessor = (
        processor: ICliCommandProcessor | undefined,
        silent?: boolean,
        fullScreen?: boolean,
    ): void => {
        if (!processor) {
            // Clearing the context processor — pop RawMode if one was active
            if (this.contextProcessor?.onData) {
                this.popMode();
            }
            this.contextProcessor = undefined;
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

        // If processor has onData, push a RawMode to intercept all input
        if (processor.onData) {
            this.pushMode(new RawMode(processor, this, fullScreen));
        }
    };

    setCurrentLine(line: string): void {
        this.lineBuffer.setText(line);
    }

    clearLine(): void {
        this.lineRenderer.clearLine(
            this.promptLength + this.lineBuffer.text.length,
        );
    }

    showPrompt(options?: {
        reset?: boolean;
        newLine?: boolean;
        keepCurrentLine?: boolean;
    }): void {
        const { reset, newLine, keepCurrentLine } = options || {};

        if (reset) {
            this.terminal.write('\x1b[2K\r');
        }

        if (newLine) {
            this.terminal.write('\r\n');
        }

        if (!keepCurrentLine) {
            this.lineBuffer.clear();
        }

        this.promptLength = this.lineRenderer.renderPrompt(
            this.getPromptOptions(),
        );

        if (this.releaseHeldInputAtPrompt) {
            this.replayHeldInput();
        }
    }

    /**
     * Submit and execute a command — shared by interactive Enter key
     * and programmatic engine.execute(). Adds to history, runs the
     * command, and shows a new prompt afterwards.
     */
    async submitCommand(command: string): Promise<void> {
        if (command.trim()) {
            await this.commandHistory.addCommand(command);
            const startedAt = Date.now();
            await this.executor.executeCommand(command, this);
            this.events?.emit('command:executed', {
                command,
                exitCode:
                    (this.executor as { exitStatus?: number }).exitStatus ?? 0,
                durationMs: Date.now() - startedAt,
            });
        }

        if (!this.isRawModeActive()) {
            this.showPrompt();
        }
    }

    clearCurrentLine(): void {
        this.clearLine();
        this.showPrompt();
    }

    refreshCurrentLine(previousContentLength?: number): void {
        const promptStr = this.lineRenderer.getPromptString(
            this.getPromptOptions(),
        );
        this.lineRenderer.refreshLine(
            this.lineBuffer.text,
            this.lineBuffer.cursorPosition,
            this.promptLength,
            promptStr,
            previousContentLength,
        );
    }

    /**
     * Redraw the prompt after a terminal resize.
     * Called by CliEngine.safeFit() when terminal columns change.
     * No-op when progress indicators, raw mode, or input requests are active.
     *
     * Uses the buffer's `isWrapped` flags to walk backwards from the cursor
     * and find the first visual line of the current logical line.  This tells
     * us exactly how many rows the prompt (+ user input) spans after xterm
     * reflow, so we can clear them all — including reflow artefacts that the
     * simple `ceil(contentLength / cols)` calculation would miss.
     */
    handleTerminalResize(): void {
        // When in raw/fullscreen mode, forward to the processor's onResize
        if (this.isRawModeActive() && this.contextProcessor?.onResize) {
            this.contextProcessor.onResize(
                this.terminal.cols,
                this.terminal.rows,
                this,
            );
            return;
        }

        if (this.isProgressRunning() || this.isRawModeActive()) {
            return;
        }

        const mode = this.currentMode;
        if (mode?.onResize) {
            mode.onResize(this.terminal.cols, this.terminal.rows);
            return;
        }

        const buf = this.terminal.buffer.active;
        let startRow = buf.cursorY;
        while (startRow > 0) {
            const line = buf.getLine(buf.baseY + startRow);
            if (!line?.isWrapped) break;
            startRow--;
        }

        const linesToClear = buf.cursorY - startRow + 1;
        this.refreshCurrentLine(linesToClear * this.terminal.cols);
    }

    public isRawModeActive(): boolean {
        return !!this.contextProcessor?.onData;
    }

    public enterFullScreenMode(
        processor: ICliCommandProcessor,
        options?: CliFullScreenOptions,
    ): void {
        this.fullScreenManager.enter(
            processor,
            this.setContextProcessor,
            this,
            options,
        );
    }

    public exitFullScreenMode(): void {
        this.fullScreenManager.exit(
            this.contextProcessor,
            this.setContextProcessor,
            () => this.timerManager.clearAll(),
            () => this.showPrompt(),
            this,
        );
    }

    public createInterval(
        callback: () => void,
        ms: number,
    ): ICliManagedInterval {
        return this.timerManager.createInterval(callback, ms);
    }

    public createTimeout(callback: () => void, ms: number): ICliManagedTimer {
        return this.timerManager.createTimeout(callback, ms);
    }

    public isProgressRunning(): boolean {
        return (
            this.progressBar.isRunning ||
            this.spinner.isRunning ||
            this.textAnimator.isRunning
        );
    }

    public abort(): void {
        if (this.progressBar.isRunning) {
            this.progressBar.complete();
        }

        if (this.spinner?.isRunning) {
            this.spinner.hide();
        }

        if (this.textAnimator?.isRunning) {
            this.textAnimator.hide();
        }

        this.onAbort.next();
    }

    public setSession(session: ICliUserSession): void {
        this.userSession = session;
    }

    // -- CommandLineModeHost interface --

    getPromptOptions(): PromptOptions {
        const usersConfig = this.services.get<any>('cli-users-module-config');
        const hideUserName = usersConfig?.hideUserName ?? false;

        // Signed out while an auth module is loaded: say so in the prompt
        const anonymousName =
            usersConfig && !this.userSession
                ? (usersConfig.anonymousName ?? 'anonymous') || undefined
                : undefined;

        return {
            userName: this.userSession?.displayName,
            hideUserName,
            anonymousName,
            contextProcessor: this.contextProcessor?.command,
            pathProvider: this.promptPathProvider,
        };
    }

    getPromptLength(): number {
        return this.promptLength;
    }

    setPromptLength(value: number): void {
        this.promptLength = value;
    }

    getExecutionContext(): ICliExecutionContext {
        return this;
    }

    /**
     * Dispose all resources. Called by CliEngine.destroy() when the
     * CLI component is being torn down.
     */
    public dispose(): void {
        // Notify the active fullscreen processor
        if (this.contextProcessor?.onDispose) {
            this.contextProcessor.onDispose(this);
        }

        (this.backgroundServices as CliBackgroundServiceRegistry)
            .destroyAll()
            .catch(() => {});

        this.timerManager.clearAll();
        this.fullScreenManager.dispose();

        if (this.windowKeydownListener) {
            window.removeEventListener(
                'keydown',
                this.windowKeydownListener,
                true,
            );
            this.windowKeydownListener = undefined;
        }

        this.stateStoreManager.dispose();
    }

    // -- Mode stack management --

    private get currentMode(): IInputMode | undefined {
        return this.modeStack.length > 0
            ? this.modeStack[this.modeStack.length - 1]
            : undefined;
    }

    pushMode(mode: IInputMode): void {
        const previous = this.currentMode;
        if (previous?.deactivate) {
            previous.deactivate();
        }
        this.modeStack.push(mode);
        if (mode.activate) {
            mode.activate();
        }
    }

    popMode(): void {
        const removed = this.modeStack.pop();
        if (removed?.deactivate) {
            removed.deactivate();
        }
        const current = this.currentMode;
        if (current?.activate) {
            current.activate();
        }
    }
}

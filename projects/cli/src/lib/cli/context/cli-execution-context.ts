import { Terminal } from '@xterm/xterm';
import { Subject } from 'rxjs';
import {
    ICliExecutionContext,
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
    clearTerminalLine,
    CliForegroundColor,
    colorFirstWord,
} from '@qodalis/cli-core';
import { CliCommandExecutorService } from '../services/cli-command-executor.service';
import { CliCommandHistoryService } from '../services/cli-command-history.service';
import { CliTerminalWriter } from '../services/cli-terminal-writer';
import { CliTerminalSpinner } from '../services/progress-bars/cli-terminal-spinner';
import { CliTerminalProgressBar } from '../services/progress-bars/cli-terminal-progress-bar';
import { CliClipboard } from '../services/cli-clipboard';
import { CliExecutionProcess } from './cli-execution-process';
import { Injector } from '@angular/core';
import { CliLogger_TOKEN, CliServiceProvider_TOKEN } from '../tokens';
import { CliStateStoreManager } from '../state/cli-state-store-manager';
import { CliTerminalTextAnimator } from '../services/progress-bars/cli-terminal-text-animator';

export class CliExecutionContext implements ICliExecutionContext {
    public userSession?: ICliUserSession;

    public contextProcessor?: ICliCommandProcessor;

    private isExecutingCommand = false;

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

    public promptLength: number = 0;

    private _currentLine: string = '';

    public get currentLine(): string {
        return this._currentLine;
    }

    public cursorPosition: number = 0;

    private historyIndex: number = 0;

    private selectionStart: { x: number; y: number } | null = null;
    private selectionEnd: { x: number; y: number } | null = null;

    private readonly commandHistoryService: CliCommandHistoryService;

    constructor(
        private injector: Injector,
        public terminal: Terminal,
        public executor: CliCommandExecutorService,
        cliOptions?: CliOptions,
    ) {
        //initialize services
        this.services = injector.get(CliServiceProvider_TOKEN);

        //initialize state store
        const stateStoreManager = injector.get(CliStateStoreManager);
        this.state = stateStoreManager.getStateStore('shared');

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

        //initialize logger
        this.logger = injector.get(CliLogger_TOKEN);
        this.logger.setCliLogLevel(cliOptions?.logLevel || CliLogLevel.ERROR);

        this.commandHistoryService = injector.get(CliCommandHistoryService);
    }

    initializeTerminalListeners(): void {
        this.commandHistoryService.initialize().then(() => {
            this.historyIndex = this.commandHistoryService.getLastIndex();
        });

        this.terminal.onData(async (data) => await this.handleInput(data));

        this.terminal.onKey(async (event) => {});

        this.terminal.attachCustomKeyEventHandler((event) => {
            if (event.type === 'keydown') {
                if (event.code === 'KeyC' && event.ctrlKey) {
                    this.abort();
                    this.setContextProcessor(undefined);
                    this.terminal.writeln('Ctrl+C');

                    if (!this.isExecutingCommand) {
                        this.showPrompt();
                    }

                    return false;
                }

                if (event.code === 'Escape') {
                    this.abort();
                    this.showPrompt({ newLine: true });
                    return false;
                }

                if (event.code === 'KeyV' && event.ctrlKey) {
                    return false;
                }

                if (event.code === 'KeyL' && event.ctrlKey) {
                    event.preventDefault();
                    this.clearCurrentLine();
                    this.terminal.clear();
                    return false;
                }

                if (
                    event.shiftKey &&
                    (event.code === 'ArrowLeft' || event.code === 'ArrowRight')
                ) {
                    if (!this.selectionStart) {
                        this.selectionStart =
                            this.getTerminalCursorPosition();
                    }

                    switch (event.code) {
                        case 'ArrowLeft':
                            this.moveCursorLeft();
                            break;
                        case 'ArrowRight':
                            this.moveCursorRight();
                            break;
                    }

                    this.selectionEnd = this.getTerminalCursorPosition();
                    this.updateSelection();
                    return false;
                } else {
                    this.selectionStart = null;
                }
            }

            return true;
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

    setCurrentLine(line: string): void {
        this._currentLine = line;
    }

    clearLine(): void {
        clearTerminalLine(
            this.terminal,
            this.promptLength + this.currentLine.length,
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
            this._currentLine = '';
            this.cursorPosition = 0;
        }

        this.terminal.write(this.getPromptString());
        this.promptLength = this.terminal.buffer.active.cursorX;
    }

    clearCurrentLine(): void {
        this.clearLine();
        this.showPrompt();
        this._currentLine = '';
        this.cursorPosition = 0;
    }

    refreshCurrentLine(previousContentLength?: number): void {
        const contentLength =
            this.promptLength + this.currentLine.length;
        const cols = this.terminal.cols;
        const clearLength = previousContentLength !== undefined
            ? Math.max(contentLength, previousContentLength)
            : contentLength;
        const lines = Math.max(1, Math.ceil(clearLength / cols));

        // Build the entire update as a single write to avoid flickering
        let output = '';

        // 1. Clear lines
        for (let i = 0; i < lines; i++) {
            output += '\x1b[2K';
            if (i < lines - 1) {
                output += '\x1b[A';
            }
        }
        output += '\r';

        // 2. Prompt
        output += this.getPromptString();

        // 3. Current line with syntax coloring
        output += colorFirstWord(
            this.currentLine,
            (word) =>
                this.writer.wrapInColor(word, CliForegroundColor.Yellow) ??
                this.currentLine,
        );

        // 4. Cursor positioning
        const cursorOffset = this.currentLine.length - this.cursorPosition;
        if (cursorOffset > 0) {
            output += `\x1b[${cursorOffset}D`;
        }

        this.terminal.write(output);
    }

    private getPromptString(): string {
        let promptStartMessage =
            this.options?.usersModule?.hideUserName ||
            !this.options?.usersModule?.enabled
                ? ''
                : `\x1b[32m${this.userSession?.user.email}\x1b[0m:`;

        if (this.contextProcessor) {
            promptStartMessage = `${this.contextProcessor.command}`;
        }

        const promptEndMessage = '\x1b[34m~\x1b[0m$ ';
        return `${promptStartMessage}${promptEndMessage}`;
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

    // -- Input handling --

    private async handleInput(data: string): Promise<void> {
        if (this.isProgressRunning()) {
            return;
        }

        if (data === '\r') {
            this.terminal.write('\r\n');

            if (this.currentLine) {
                await this.commandHistoryService.addCommand(this.currentLine);
                this.historyIndex = this.commandHistoryService.getLastIndex();
                this.cursorPosition = 0;

                this.isExecutingCommand = true;
                await this.executor.executeCommand(this.currentLine, this);
                this.isExecutingCommand = false;

                if (this.onAbort.observed) {
                    this.terminal.writeln(
                        '\x1b[33m' + 'Press Ctrl+C to cancel' + '\x1b[0m',
                    );
                }
            }

            this.showPrompt();
        } else if (data === '\u001B[A') {
            this.showPreviousCommand();
        } else if (data === '\u001B[B') {
            this.showNextCommand();
        } else if (data === '\u001B[D') {
            this.moveCursorLeft(data);
        } else if (data === '\u001B[C') {
            this.moveCursorRight(data);
        } else if (data === '\u007F') {
            this.handleBackspace();
        } else {
            this.handleInputText(data);
        }
    }

    private normalizeText(text: string): string {
        if (text === '\u0009') {
            return '    ';
        }
        return text.replace(/[\r\n]+/g, '');
    }

    private handleInputText(text: string): void {
        text = this.normalizeText(text);

        this._currentLine =
            this._currentLine.slice(0, this.cursorPosition) +
            text +
            this._currentLine.slice(this.cursorPosition);

        this.cursorPosition += text.length;
        this.refreshCurrentLine();
    }

    private handleBackspace(): void {
        if (this.cursorPosition > 0) {
            this._currentLine =
                this._currentLine.slice(0, this.cursorPosition - 1) +
                this._currentLine.slice(this.cursorPosition);
            this.cursorPosition--;
            this.refreshCurrentLine();
        }
    }

    private moveCursorLeft(key: string = '\x1b[D'): void {
        if (this.cursorPosition > 0) {
            this.cursorPosition--;
            this.terminal.write(key);
        }
    }

    private moveCursorRight(key: string = '\x1b[C'): void {
        if (this.cursorPosition < this.currentLine.length) {
            this.cursorPosition++;
            this.terminal.write(key);
        }
    }

    // -- History --

    private showPreviousCommand(): void {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.displayCommandFromHistory();
        }
    }

    private showNextCommand(): void {
        if (this.historyIndex < this.commandHistoryService.getLastIndex() - 1) {
            this.historyIndex++;
            this.displayCommandFromHistory();
        } else {
            this.historyIndex = this.commandHistoryService.getLastIndex();
            const previousContentLength = this.promptLength + this._currentLine.length;
            this._currentLine = '';
            this.cursorPosition = 0;
            this.refreshCurrentLine(previousContentLength);
        }
    }

    private displayCommandFromHistory(): void {
        const previousContentLength = this.promptLength + this._currentLine.length;
        this._currentLine =
            this.commandHistoryService.getCommand(this.historyIndex) || '';
        this.cursorPosition = this._currentLine.length;
        this.refreshCurrentLine(previousContentLength);
    }

    // -- Selection --

    private getTerminalCursorPosition() {
        const x: number = (this.terminal as any)._core.buffer.x;
        const y: number = (this.terminal as any)._core.buffer.y;
        return { x, y };
    }

    private updateSelection(): void {
        if (this.selectionStart && this.selectionEnd) {
            const startRow = Math.min(
                this.selectionStart.y,
                this.selectionEnd.y,
            );
            const endRow = Math.max(
                this.selectionStart.y,
                this.selectionEnd.y,
            );

            if (startRow === endRow) {
                const startCol = Math.min(
                    this.selectionStart.x,
                    this.selectionEnd.x,
                );
                const endCol = Math.max(
                    this.selectionStart.x,
                    this.selectionEnd.x,
                );
                this.terminal.select(
                    startCol,
                    startRow,
                    Math.abs(endCol - startCol),
                );
            } else {
                this.terminal.selectLines(startRow, endRow);
            }
        }
    }
}

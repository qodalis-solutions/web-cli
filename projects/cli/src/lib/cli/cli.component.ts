import {
    AfterViewInit,
    Component,
    ElementRef,
    Inject,
    Input,
    OnDestroy,
    OnInit,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import {
    ITerminalInitOnlyOptions,
    ITerminalOptions,
    Terminal,
} from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { CliCommandExecutorService } from './services/cli-command-executor.service';
import { CommandHistoryService } from './services/command-history.service';
import {
    CliOptions,
    ICliUserSession,
    ICliUserSessionService,
} from '@qodalis/cli-core';
import { CliExecutionContext } from './services/cli-execution-context';
import { ICliUserSessionService_TOKEN } from './tokens';
import { LIBRARY_VERSION } from '../version';

@Component({
    selector: 'app-cli',
    templateUrl: './cli.component.html',
    styleUrls: ['./cli.component.sass'],
    encapsulation: ViewEncapsulation.None,
})
export class CliComponent implements OnInit, AfterViewInit, OnDestroy {
    @Input() options?: CliOptions;

    private currentLine = '';
    private executionContext?: CliExecutionContext;
    private currentUserSession: ICliUserSession | undefined;

    // xterm dependencies
    @ViewChild('terminal', { static: true }) terminalDiv!: ElementRef;
    private terminal!: Terminal;
    private fitAddon!: FitAddon;
    private resizeObserver!: ResizeObserver;

    constructor(
        @Inject(ICliUserSessionService_TOKEN)
        private readonly userManagementService: ICliUserSessionService,
        private commandExecutor: CliCommandExecutorService,
        private readonly commandHistoryService: CommandHistoryService,
    ) {
        this.userManagementService.getUserSession().subscribe((session) => {
            this.currentUserSession = session;
            this.executionContext?.setSession(session!);

            if (this.terminal) {
                this.printPrompt({
                    reset: true,
                });
            }
        });
    }

    ngOnInit(): void {
        this.initializeTerminal();
    }

    ngAfterViewInit(): void {
        this.handleResize();

        this.displayWelcomeMessage();
    }

    private displayWelcomeMessage() {
        if (this.options?.welcomeMessage) {
            this.terminal.writeln(this.options.welcomeMessage);
        } else {
            const welcomeMessage = [
                `Web CLI [Version ${LIBRARY_VERSION}]`,
                '(c) 2024 Qodalis Solutions. All rights reserved.',
                '',
                "Type 'help' to get started.",
                '',
            ];

            welcomeMessage.forEach((line, index) => {
                this.terminal.write(line + '\r\n');
            });
        }

        this.printPrompt();
    }

    private initializeTerminal(): void {
        const terminalOptions: ITerminalOptions & ITerminalInitOnlyOptions = {
            cursorBlink: true,
            allowProposedApi: true,
            fontSize: 20,
            theme: {
                background: '#0c0c0c',
                foreground: '#cccccc',
                green: '#16c60c',
                blue: '#3b78ff',
                yellow: '#FFA500',
            },
            ...(this.options?.terminalOptions ?? {}),
        };

        this.terminal = new Terminal(terminalOptions);

        this.fitAddon = new FitAddon();

        this.terminal.loadAddon(this.fitAddon);

        this.terminal.open(this.terminalDiv.nativeElement);

        // Handle user input
        this.terminal.onData(async (data) => await this.handleInput(data));

        this.terminal.onKey(async (event) => {});

        this.terminal.attachCustomKeyEventHandler((event) => {
            if (event.type === 'keydown') {
                if (event.code === 'KeyC' && event.ctrlKey) {
                    // Handle Ctrl+C
                    this.executionContext?.abort();
                    this.terminal.writeln('Ctrl+C');
                    this.printPrompt();

                    return false;
                }

                if (event.code === 'Escape') {
                    // Handle Escape
                    this.executionContext?.abort();
                    this.printPrompt({
                        newLine: true,
                    });

                    return false;
                }

                if (event.code === 'KeyV' && event.ctrlKey) {
                    //Handle Ctrl+V
                    return false;
                }
            }

            return true;
        });

        // Handle paste events
        this.terminalDiv.nativeElement.addEventListener(
            'paste',
            (event: ClipboardEvent) => {
                this.handlePaste(event);
            },
        );

        this.executionContext = new CliExecutionContext(
            this.terminal,
            this.commandExecutor,
            () => this.printPrompt(),
            {
                ...(this.options ?? {}),
                terminalOptions: terminalOptions,
            },
        );

        this.executionContext.setSession(this.currentUserSession!);

        this.commandExecutor.initializeProcessors(this.executionContext);
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

    private printPrompt(options?: {
        reset?: boolean;
        newLine?: boolean;
    }): void {
        const { reset, newLine } = options || {};

        if (reset) {
            this.terminal.write('\x1b[2K\r');
        }

        if (newLine) {
            this.terminal.write('\r\n');
        }

        this.currentLine = '';
        this.cursorPosition = 0;

        const promtStartMessage = this.options?.hideUserName
            ? ''
            : `\x1b[32m${this.currentUserSession?.user.email}\x1b[0m:`;
        const promtEndMessage = '\x1b[34m~\x1b[0m$ ';

        const prompt = `${promtStartMessage}${promtEndMessage}`;

        this.terminal.write(prompt);
    }

    private historyIndex: number = this.commandHistoryService.getLastIndex();
    private cursorPosition: number = 0;

    private async handleInput(data: string): Promise<void> {
        if (this.executionContext?.isProgressRunning()) {
            return;
        }

        if (data === '\r') {
            // Enter key: Process the current command
            this.terminal.write('\r\n'); // Move to the next line

            if (this.currentLine) {
                this.commandHistoryService.addCommand(this.currentLine);

                this.historyIndex = this.commandHistoryService.getLastIndex();

                //reset cursor position
                this.cursorPosition = 0;

                await this.commandExecutor.executeCommand(
                    this.currentLine,
                    this.executionContext!,
                );

                //check if the command has subscribed to the onAbort event
                if (this.executionContext?.onAbort.observed) {
                    this.terminal.writeln(
                        '\x1b[33m' + 'Press Ctrl+C to cancel' + '\x1b[0m',
                    );
                }
            }

            this.printPrompt();
        } else if (data === '\u001B[A') {
            // Arrow Up
            this.showPreviousCommand();
        } else if (data === '\u001B[B') {
            // Arrow Down
            this.showNextCommand();
        } else if (data === '\u001B[D') {
            // Left Arrow
            this.moveCursorLeft(data);
        } else if (data === '\u001B[C') {
            // Right Arrow
            this.moveCursorRight(data);
        } else if (data === '\u000C') {
            // CTRL + L
            this.terminal.clear();
        } else if (data === '\u007F') {
            // Backspace key
            this.handleBackspace();
        } else {
            // Append character at cursor position
            this.handleInputText(data);
        }
    }

    private normalizeText(text: string): string {
        //handle tab
        if (text === '\u0009') {
            return '    ';
        }

        return text;
    }

    private handleInputText(text: string): void {
        text = this.normalizeText(text);

        const textLength = text.length;
        this.cursorPosition += textLength;

        if (this.cursorPosition <= this.currentLine.length) {
            this.currentLine =
                this.currentLine.substring(0, this.cursorPosition - 1) +
                text +
                this.currentLine.substring(this.cursorPosition);
        } else {
            this.currentLine += text;
        }
        this.terminal.write(text);
    }

    private handlePaste(event: ClipboardEvent): void {
        // Get pasted data from the clipboard
        const pasteData = event.clipboardData?.getData('text')?.trim() || '';

        this.handleInput(pasteData);

        event.preventDefault(); // Prevent the default paste behavior
    }

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
            this.clearCurrentLine();
        }
    }

    private displayCommandFromHistory(): void {
        this.clearCurrentLine();
        this.currentLine =
            this.commandHistoryService.getCommand(this.historyIndex) || '';
        this.terminal.write(this.currentLine);
        this.cursorPosition = this.currentLine.length;
    }

    private clearCurrentLine(): void {
        const currentLength = this.currentLine.length;
        if (currentLength > 0) {
            // Erase the current line
            this.terminal.write('\b \b'.repeat(currentLength));
        }
        this.currentLine = '';
        this.cursorPosition = 0;
    }

    private moveCursorLeft(key: string): void {
        if (this.cursorPosition > 0) {
            this.cursorPosition--;
            this.terminal.write(key);
        }
    }

    private moveCursorRight(key: string): void {
        if (this.cursorPosition < this.currentLine.length) {
            this.cursorPosition++;
            this.terminal.write(key);
        }
    }

    private handleBackspace(): void {
        if (this.cursorPosition > 0) {
            this.currentLine = this.currentLine.slice(0, -1);
            this.cursorPosition--;
            this.terminal.write('\b \b');
        }
    }

    ngOnDestroy(): void {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        this.terminal?.dispose();
    }
}

import { Terminal } from '@xterm/xterm';
import { ICliExecutionContext, ICliSpinner } from '@qodalis/cli-core';

export class CliTerminalSpinner implements ICliSpinner {
    isRunning: boolean = false;

    text: string = '';

    context?: ICliExecutionContext;

    constructor(private terminal: Terminal) {}

    private spinnerInterval?: ReturnType<typeof setInterval> | null;
    private spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    private spinnerColors = [
        '\x1b[38;5;39m',  // blue
        '\x1b[38;5;45m',  // cyan
        '\x1b[38;5;49m',  // teal
        '\x1b[38;5;48m',  // green-cyan
        '\x1b[38;5;83m',  // green
        '\x1b[38;5;118m', // lime
        '\x1b[38;5;154m', // yellow-green
        '\x1b[38;5;220m', // yellow
        '\x1b[38;5;214m', // orange
        '\x1b[38;5;171m', // purple
    ];
    private spinnerIndex = 0;
    private savedCurrentLine = '';
    private lastContentLength = 0;
    private lastLineCount = 1;
    private resizeDisposable?: { dispose(): void };

    public show(text?: string): void {
        if (text) {
            this.text = text;
        }

        if (this.context) {
            this.savedCurrentLine = this.context.currentLine;
            this.context.setCurrentLine('');
        }

        this.lastContentLength = 0;
        this.lastLineCount = 1;
        this.isRunning = true;

        this.resizeDisposable = this.terminal.onResize(() => {
            this.lastLineCount = Math.max(
                this.lastLineCount,
                this.calcLineCount(this.lastContentLength),
            );
        });

        this.spinnerInterval = setInterval(() => {
            this.clearCurrentLine();

            const RESET = '\x1b[0m';
            const frame = this.spinnerFrames[this.spinnerIndex];
            const color = this.spinnerColors[this.spinnerIndex % this.spinnerColors.length];
            const textSuffix = this.text.length > 0 ? ` ${this.text}` : '';

            const content = `${color}${frame}${RESET}${textSuffix}`;
            // Plain length: 1 char for frame + text suffix
            const plainLength = 1 + textSuffix.length;

            this.terminal.write(content);
            this.lastContentLength = plainLength;
            this.lastLineCount = this.calcLineCount(plainLength);
            if (this.context) {
                this.context.setCurrentLine(content);
            }

            this.spinnerIndex =
                (this.spinnerIndex + 1) % this.spinnerFrames.length;
        }, 80);
    }

    public hide(): void {
        this.isRunning = false;
        if (this.spinnerInterval) {
            clearInterval(this.spinnerInterval);
            this.spinnerInterval = null;
        }

        this.resizeDisposable?.dispose();
        this.resizeDisposable = undefined;

        this.clearCurrentLine();

        if (this.context) {
            this.context.setCurrentLine(this.savedCurrentLine);
        }

        this.text = '';
        this.savedCurrentLine = '';
        this.lastContentLength = 0;
        this.lastLineCount = 1;
    }

    public setText(text: string) {
        this.text = text;
    }

    private clearCurrentLine(): void {
        const lines = Math.max(
            this.lastLineCount,
            this.calcLineCount(this.lastContentLength),
        );

        for (let i = 0; i < lines; i++) {
            this.terminal.write('\x1b[2K');
            if (i < lines - 1) {
                this.terminal.write('\x1b[A');
            }
        }

        this.terminal.write('\r');
    }

    private calcLineCount(contentLength: number): number {
        return Math.max(1, Math.ceil(contentLength / this.terminal.cols));
    }
}

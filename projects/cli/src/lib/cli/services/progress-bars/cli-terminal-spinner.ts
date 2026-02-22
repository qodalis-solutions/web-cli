import { Terminal } from '@xterm/xterm';
import { ICliExecutionContext, ICliSpinner } from '@qodalis/cli-core';

export class CliTerminalSpinner implements ICliSpinner {
    isRunning: boolean = false;

    text: string = '';

    context?: ICliExecutionContext;

    constructor(private terminal: Terminal) {}

    private spinnerInterval?: ReturnType<typeof setInterval> | null;
    private spinnerFrames = ['|', '/', '-', '\\'];
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
            // Write the spinner frame
            const content =
                this.spinnerFrames[this.spinnerIndex] +
                (this.text.length > 0 ? ` ${this.text}` : '');
            this.terminal.write(content);
            this.lastContentLength = content.length;
            this.lastLineCount = this.calcLineCount(content.length);
            if (this.context) {
                this.context.setCurrentLine(content);
            }
            // Update the frame index
            this.spinnerIndex =
                (this.spinnerIndex + 1) % this.spinnerFrames.length;
        }, 100);
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

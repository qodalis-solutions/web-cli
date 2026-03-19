import { Terminal } from '@xterm/xterm';
import {
    CliPercentageProgressBarUpdateValueOptions,
    ICliExecutionContext,
    ICliPercentageProgressBar,
} from '@qodalis/cli-core';

export class CliTerminalProgressBar implements ICliPercentageProgressBar {
    isRunning: boolean = false;

    context?: ICliExecutionContext;

    private text: string = '';
    private progressBarInterval?: ReturnType<typeof setInterval> | null;
    private progress = 0;
    private total = 100;
    private progressText = '';
    private progressTextPlainLength = 0;
    private savedCurrentLine = '';
    private tickCount = 0;
    private lastLineCount = 1;
    private resizeDisposable?: { dispose(): void };

    constructor(private terminal: Terminal) {}

    public show(text?: string): void {
        this.isRunning = true;
        this.progress = 0;
        this.tickCount = 0;
        this.lastLineCount = 1;
        this.text = text || '';

        if (this.context) {
            this.savedCurrentLine = this.context.currentLine;
            this.context.setCurrentLine('');
        }

        this.resizeDisposable = this.terminal.onResize(() => {
            this.lastLineCount = Math.max(
                this.lastLineCount,
                this.calcLineCount(this.progressTextPlainLength),
            );
        });

        // Update progress bar every 100ms
        this.progressBarInterval = setInterval(() => {
            this.tickCount++;

            // Auto-increment for smooth animation, slowing down as progress increases
            if (this.tickCount % 3 === 0 && this.progress < 90) {
                const step =
                    this.progress < 30 ? 2 : this.progress < 60 ? 1 : 0.5;
                this.progress = Math.min(90, this.progress + step);
            }

            this.updateProgressBar();

            // Stop when progress reaches 100%
            if (this.progress > this.total) {
                this.progress = this.total;
                this.hide(); // Stop the progress bar
            }
        }, 100);
    }

    public hide(): void {
        this.isRunning = false;
        if (this.progressBarInterval) {
            clearInterval(this.progressBarInterval);
            this.progressBarInterval = null;
        }

        this.resizeDisposable?.dispose();
        this.resizeDisposable = undefined;

        this.clearCurrentLine();

        if (this.context) {
            this.context.setCurrentLine(this.savedCurrentLine);
        }

        this.text = '';
        this.progressText = '';
        this.progressTextPlainLength = 0;
        this.savedCurrentLine = '';
        this.lastLineCount = 1;
    }

    public update(
        progress: number,
        options?: CliPercentageProgressBarUpdateValueOptions,
    ) {
        if (options?.type === 'increment') {
            this.progress += progress;
        } else {
            this.progress = progress;
        }

        if (this.progress > this.total) {
            this.progress = this.total;
        }

        this.updateProgressBar();
    }

    public complete() {
        this.progress = 100;
        this.hide();
    }

    public setText(text: string) {
        this.text = text;

        this.updateProgressBar();
    }

    private updateProgressBar(): void {
        const displayProgress = Math.round(this.progress);
        const totalBars = 30; // Length of the progress bar
        const filledBars = Math.round(
            (displayProgress / this.total) * totalBars,
        );
        const emptyBars = totalBars - filledBars;

        const RESET = '\x1b[0m';
        const CYAN = '\x1b[36m';
        const BRIGHT_CYAN = '\x1b[1;36m';
        const DIM = '\x1b[2m';

        // Shimmer: a bright highlight that sweeps across the filled portion
        const shimmerPos = this.tickCount % (filledBars + 4);
        let filledStr = '';

        for (let i = 0; i < filledBars; i++) {
            const isShimmer = i >= shimmerPos - 1 && i <= shimmerPos;
            filledStr += `${isShimmer ? BRIGHT_CYAN : CYAN}━${RESET}`;
        }

        const emptyStr = `${DIM}${'─'.repeat(emptyBars)}${RESET}`;

        const progressBar = `${CYAN}[${RESET}${filledStr}${emptyStr}${CYAN}]${RESET}`;
        const percentage = `${CYAN}${displayProgress}%${RESET}`.padStart(4, ' ');
        const text = this.text.length > 0 ? ` ${DIM}${this.text}${RESET}` : '';

        this.clearCurrentLine();
        this.progressText = `${progressBar} ${percentage} ${text}`;
        // Plain-text length for line-wrap calculation (no ANSI codes)
        this.progressTextPlainLength =
            1 + totalBars + 1 + 1 + 4 + 1 + this.text.length + 1;

        this.terminal.write(this.progressText);
        this.lastLineCount = this.calcLineCount(this.progressTextPlainLength);

        if (this.context) {
            this.context.setCurrentLine(this.progressText);
        }
    }

    private clearCurrentLine(): void {
        const lines = Math.max(
            this.lastLineCount,
            this.calcLineCount(this.progressTextPlainLength),
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

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
        const totalBars = 50; // Length of the progress bar
        const filledBars = Math.round(
            (displayProgress / this.total) * totalBars,
        );
        const emptyBars = totalBars - filledBars;

        // Build color-animated filled portion
        const RESET = '\x1b[0m';
        const DIM = '\x1b[2m';
        let filledStr = '';
        const shimmerPos = this.tickCount % (filledBars + 6);

        for (let i = 0; i < filledBars; i++) {
            const ratio = filledBars > 1 ? i / (filledBars - 1) : 1;
            const color = this.progressGradientColor(ratio);
            const isShimmer = i >= shimmerPos - 2 && i <= shimmerPos;
            const bright = isShimmer ? '\x1b[1m' : '';
            filledStr += `${color}${bright}#${RESET}`;
        }

        const emptyStr = `${DIM}${'.'.repeat(emptyBars)}${RESET}`;

        const progressBar = `[${filledStr}${emptyStr}]`;
        const percentage = `${displayProgress}%`.padStart(4, ' ');
        const text = this.text.length > 0 ? ` ${this.text}` : '';

        this.clearCurrentLine();
        this.progressText = `${progressBar} ${percentage} ${text}`;
        // Plain-text length for line-wrap calculation (no ANSI codes)
        this.progressTextPlainLength =
            1 + totalBars + 1 + 1 + 4 + 1 + text.length;

        this.terminal.write(this.progressText);
        this.lastLineCount = this.calcLineCount(this.progressTextPlainLength);

        if (this.context) {
            this.context.setCurrentLine(this.progressText);
        }
    }

    /**
     * Returns an ANSI 256-color escape for a position in the progress bar.
     * Gradient: red (0%) -> yellow (50%) -> green (100%).
     */
    private progressGradientColor(ratio: number): string {
        let r: number, g: number;
        if (ratio < 0.5) {
            // red -> yellow
            r = 5;
            g = Math.round((ratio / 0.5) * 5);
        } else {
            // yellow -> green
            r = Math.round(((1 - ratio) / 0.5) * 5);
            g = 5;
        }
        // 256-color: 16 + 36*r + 6*g + b
        const colorIndex = 16 + 36 * r + 6 * g + 0;
        return `\x1b[38;5;${colorIndex}m`;
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

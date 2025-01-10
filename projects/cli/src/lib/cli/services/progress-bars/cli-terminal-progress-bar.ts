import { Terminal } from '@xterm/xterm';
import {
    CliPercentageProgressBarUpdateValueOptions,
    ICliPercentageProgressBar,
} from '@qodalis/cli-core';

export class CliTerminalProgressBar implements ICliPercentageProgressBar {
    isRunning: boolean = false;

    private text: string = '';
    private progressBarInterval?: ReturnType<typeof setInterval> | null;
    private progress = 0;
    private total = 100;
    private progressText = '';

    constructor(private terminal: Terminal) {}

    public show(text?: string): void {
        this.isRunning = true;
        this.progress = 0;
        this.text = text || '';

        // Update progress bar every 100ms
        this.progressBarInterval = setInterval(() => {
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

        this.clearCurrentLine();

        this.text = '';
        this.progressText = '';
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
        const totalBars = 50; // Length of the progress bar
        const filledBars = Math.round((this.progress / this.total) * totalBars);
        const emptyBars = totalBars - filledBars;

        const progressBar = `[${'#'.repeat(filledBars)}${'.'.repeat(emptyBars)}]`;
        const percentage = `${this.progress}%`.padStart(4, ' ');
        const text = this.text.length > 0 ? ` ${this.text}` : '';

        this.clearCurrentLine();
        this.progressText = `${progressBar} ${percentage} ${text}`;

        this.terminal.write(this.progressText); // Write progress bar
    }

    private clearCurrentLine(): void {
        const wrappedLines = Math.ceil(
            this.progressText.length / this.terminal.cols,
        );

        for (let i = 0; i < wrappedLines; i++) {
            this.terminal.write('\x1b[2K'); // Clear the current line
            this.terminal.write('\r'); // Move the cursor to the start of the line
            if (i < wrappedLines - 1) {
                this.terminal.write('\x1b[F'); // Move the cursor up for all but the last line
            }

            if (i === wrappedLines - 1) {
                this.terminal.write('\r');
            }
        }
    }
}

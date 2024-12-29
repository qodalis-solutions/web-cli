import { Terminal } from '@xterm/xterm';
import { ICliPercentageProgressBar } from '@qodalis/cli-core';

export class CliTerminalProgressBar implements ICliPercentageProgressBar {
    isRunning: boolean = false;

    constructor(private terminal: Terminal) {}

    private progressBarInterval?: ReturnType<typeof setInterval> | null;
    private progress = 0;
    private total = 100;

    public show(): void {
        this.isRunning = true;
        this.progress = 0;

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

        // Clear the progress bar and reset the line
        this.terminal.write('\x1b[2K\r');
    }

    public update(progress: number) {
        this.progress = progress;

        if (this.progress > this.total) {
            this.progress = this.total;
        }

        this.updateProgressBar();
    }

    public complete() {
        this.progress = 100;
        this.hide();
    }

    private updateProgressBar(): void {
        const totalBars = 50; // Length of the progress bar
        const filledBars = Math.round((this.progress / this.total) * totalBars);
        const emptyBars = totalBars - filledBars;

        const progressBar = `[${'#'.repeat(filledBars)}${'.'.repeat(emptyBars)}]`;
        const percentage = `${this.progress}%`.padStart(4, ' ');

        // Clear the current line and render the progress bar
        this.terminal.write('\x1b[2K\r'); // Clear the current line
        this.terminal.write(`${progressBar} ${percentage}`); // Write progress bar
    }
}

import { Terminal } from '@xterm/xterm';
import { ICliSpinner } from '@qodalis/cli-core';

export class CliTerminalSpinner implements ICliSpinner {
    isRunning: boolean = false;

    constructor(private terminal: Terminal) {}

    private spinnerInterval?: ReturnType<typeof setInterval> | null;
    private spinnerFrames = ['|', '/', '-', '\\'];
    private spinnerIndex = 0;

    public show(): void {
        this.isRunning = true;
        this.spinnerInterval = setInterval(() => {
            // Clear the current line
            this.terminal.write('\x1b[2K\r');
            // Write the spinner frame
            this.terminal.write(this.spinnerFrames[this.spinnerIndex]);
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

        // Clear the spinner character and reset the line
        this.terminal.write('\x1b[2K\r');
    }
}

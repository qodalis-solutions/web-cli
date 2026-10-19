import { Terminal } from '@xterm/xterm';
import {
    CliTextAnimatorOptions,
    delay,
    ICliExecutionContext,
    ICliTextAnimator,
} from '@qodalis/cli-core';

export class CliTerminalTextAnimator implements ICliTextAnimator {
    isRunning: boolean = false;

    context?: ICliExecutionContext;

    private animationInterval?: ReturnType<typeof setInterval> | null;
    /** Characters of the current animation still visible on the line. */
    private visibleChars = 0;
    /** Ends the current `showText` promise early (set while it runs). */
    private finish?: () => void;
    private text: string = '';
    private textColor = '\x1b[38;5;249m'; // light gray

    constructor(private terminal: Terminal) {}

    public show(text?: string): void {
        this.showText(text || '');
    }

    showText(text: string, options?: CliTextAnimatorOptions): Promise<void> {
        const { speed, removeAfterTyping } = options || {};

        if (this.isRunning) {
            return Promise.resolve();
        }

        this.isRunning = true;
        this.text = text || this.text;

        const savedCurrentLine = this.context?.currentLine || '';
        let index = 0;
        let isTyping = true;

        const RESET = '\x1b[0m';

        this.visibleChars = 0;

        return new Promise<void>((resolve) => {
            let done = false;
            this.finish = () => {
                if (done) return;
                done = true;
                this.finish = undefined;
                this.isRunning = false;
                resolve();
            };

            this.animationInterval = setInterval(() => {
                if (isTyping) {
                    // Write text character by character with wave color
                    const ch = this.text[index];
                    this.terminal.write(`${this.textColor}${ch}${RESET}`);
                    index++;
                    this.visibleChars++;

                    // Switch to erasing mode once typing is done
                    if (index === this.text.length) {
                        isTyping = false;
                    }
                } else if (removeAfterTyping) {
                    clearInterval(this.animationInterval!);
                    this.animationInterval = null;

                    delay(1000).then(() => {
                        // Cancelled meanwhile (e.g. the user started typing)
                        if (done) return;
                        if (this.context) {
                            this.context.setCurrentLine(
                                savedCurrentLine + this.text,
                            );
                            this.context.clearCurrentLine();
                        }
                        this.visibleChars = 0;
                        this.finish?.();
                    });
                } else {
                    // Erase text character by character
                    this.terminal.write('\b \b');
                    index--;
                    this.visibleChars = Math.max(0, this.visibleChars - 1);

                    // Stop animation once all characters are erased
                    if (index < 0) {
                        clearInterval(this.animationInterval!);
                        this.animationInterval = null;
                        this.finish?.();
                    }
                }
            }, speed || 100);
        });
    }

    /**
     * Stop the animation, erase the text it wrote and resolve its `showText`
     * promise. Used when the user starts typing over the greeting.
     */
    public cancel(): void {
        if (!this.isRunning) {
            return;
        }
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
        this.terminal.write('\b \b'.repeat(this.visibleChars));
        this.visibleChars = 0;
        this.finish?.();
    }

    /**
     * Hide the animation and reset the state.
     */
    public hide(): void {
        if (!this.isRunning) {
            return; // Prevent stopping if not running
        }

        this.isRunning = false;

        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }

        this.text = '';
    }
}

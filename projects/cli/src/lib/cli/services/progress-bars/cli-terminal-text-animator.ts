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
    private text: string = '';

    constructor(private terminal: Terminal) {}

    public show(text?: string): void {
        this.showText(text || '');
    }

    showText(text: string, options?: CliTextAnimatorOptions) {
        const { speed, removeAfterTyping } = options || {};

        if (this.isRunning) {
            return; // Prevent multiple animations
        }

        this.isRunning = true;
        this.text = text || this.text;

        const savedCurrentLine = this.context?.currentLine || '';
        let index = 0;
        let isTyping = true;

        this.animationInterval = setInterval(() => {
            if (isTyping) {
                // Write text character by character
                this.terminal.write(this.text[index]);
                index++;

                // Switch to erasing mode once typing is done
                if (index === this.text.length) {
                    isTyping = false;
                }
            } else if (removeAfterTyping) {
                clearInterval(this.animationInterval!);
                this.animationInterval = null;

                delay(1000).then(() => {
                    if (this.context) {
                        this.context.setCurrentLine(
                            savedCurrentLine + this.text,
                        );
                        this.context.clearCurrentLine();
                    }
                });

                this.isRunning = false;
            } else {
                // Erase text character by character
                this.terminal.write('\b \b');
                index--;

                // Stop animation once all characters are erased
                if (index < 0) {
                    clearInterval(this.animationInterval!);
                    this.animationInterval = null;
                    this.isRunning = false;
                }
            }
        }, speed || 100);
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

import { CliLineOptions } from '@qodalis/cli-core';
import { InputModeHost } from '../input-mode';
import { InputModeBase } from './input-mode-base';

/**
 * Input mode for reading a single line of text.
 * Supports default value, placeholder, validation, and cursor navigation.
 */
export class LineInputMode extends InputModeBase<string> {
    private buffer: string;
    private cursorPosition: number;
    private hasError = false;

    constructor(
        host: InputModeHost,
        resolve: (value: string | null) => void,
        private readonly promptText: string,
        private readonly options?: CliLineOptions,
    ) {
        super(host, resolve);
        this.buffer = options?.default ?? '';
        this.cursorPosition = this.buffer.length;
    }

    activate(): void {
        const prompt = `\x1b[36m?\x1b[0m ${this.promptText}`;
        this.host.writeToTerminal(prompt);
        if (this.buffer) {
            this.host.writeToTerminal(this.buffer);
        } else if (this.options?.placeholder) {
            this.host.writeToTerminal(`\x1b[2m${this.options.placeholder}\x1b[0m`);
            this.host.terminal.write(`\x1b[${this.options.placeholder.length}D`);
        }
    }

    async handleInput(data: string): Promise<void> {
        if (this.hasError) {
            this.hasError = false;
            this.clearExtraLines();
        }

        if (data === '\r') {
            if (this.options?.validate) {
                const error = this.options.validate(this.buffer);
                if (error) {
                    this.hasError = true;
                    this.writeError(error);
                    return;
                }
            }
            this.resolveAndPop(this.buffer);
        } else if (data === '\u007F') {
            // Backspace
            if (this.cursorPosition > 0) {
                this.buffer =
                    this.buffer.slice(0, this.cursorPosition - 1) +
                    this.buffer.slice(this.cursorPosition);
                this.cursorPosition--;
                this.renderLine();
            }
        } else if (data === '\u001B[D') {
            // Left arrow
            if (this.cursorPosition > 0) {
                this.cursorPosition--;
                this.host.terminal.write(data);
            }
        } else if (data === '\u001B[C') {
            // Right arrow
            if (this.cursorPosition < this.buffer.length) {
                this.cursorPosition++;
                this.host.terminal.write(data);
            }
        } else if (data.startsWith('\u001B')) {
            // Ignore other escape sequences
        } else {
            const text = data.replace(/[\r\n]+/g, '');
            this.buffer =
                this.buffer.slice(0, this.cursorPosition) +
                text +
                this.buffer.slice(this.cursorPosition);
            this.cursorPosition += text.length;

            // Fast path: appending at end with no extra lines — just write the chars
            // Skip fast path when placeholder was visible (buffer length == text length
            // means buffer was empty before this insert, so placeholder needs clearing)
            if (
                this.cursorPosition === this.buffer.length &&
                this.extraLines === 0 &&
                !this.hasError &&
                !(this.options?.placeholder && this.buffer.length === text.length)
            ) {
                this.host.terminal.write(text);
            } else {
                this.renderLine();
            }
        }
    }

    onResize(): void {
        this.renderLine();
    }

    private renderLine(): void {
        const prompt = `\x1b[36m?\x1b[0m ${this.promptText}`;
        if (this.buffer.length === 0 && this.options?.placeholder) {
            // redrawLine positions cursor at end; we need it at start of placeholder
            const placeholder = `\x1b[2m${this.options.placeholder}\x1b[0m`;
            this.redrawLine(prompt, placeholder, 0);
        } else {
            this.redrawLine(prompt, this.buffer, this.cursorPosition);
        }
    }
}

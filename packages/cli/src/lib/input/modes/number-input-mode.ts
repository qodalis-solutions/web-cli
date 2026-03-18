import { InputModeHost } from '../input-mode';
import { InputModeBase } from './input-mode-base';

/**
 * Options for NumberInputMode.
 */
export interface NumberInputOptions {
    /** Minimum allowed value (inclusive). Validation error shown if below. */
    min?: number;
    /** Maximum allowed value (inclusive). Validation error shown if above. */
    max?: number;
    /** Pre-filled default value. Used when Enter is pressed with an empty buffer. */
    default?: number;
}

/**
 * Input mode for reading an integer number.
 * Only accepts digits and a minus sign at position 0.
 * Supports left/right cursor navigation.
 * Validates min/max constraints on Enter.
 */
export class NumberInputMode extends InputModeBase<number> {
    private buffer: string;
    private cursorPosition: number;
    private hasError = false;

    constructor(
        host: InputModeHost,
        resolve: (value: number | null) => void,
        private readonly promptText: string,
        private readonly options?: NumberInputOptions,
    ) {
        super(host, resolve);
        this.buffer = options?.default != null ? String(options.default) : '';
        this.cursorPosition = this.buffer.length;
    }

    activate(): void {
        const prompt = this.buildPrompt();
        this.host.writeToTerminal(prompt);
        if (this.buffer) {
            this.host.writeToTerminal(this.buffer);
        }
    }

    async handleInput(data: string): Promise<void> {
        if (this.hasError) {
            this.hasError = false;
            this.clearExtraLines();
        }

        if (data === '\r') {
            if (this.buffer === '' || this.buffer === '-') {
                if (this.options?.default != null) {
                    this.resolveAndPop(this.options.default);
                }
                // Otherwise do nothing — require the user to enter a value
                return;
            }

            const value = parseInt(this.buffer, 10);

            if (isNaN(value)) {
                this.hasError = true;
                this.writeError('Please enter a valid number');
                return;
            }

            if (this.options?.min != null && value < this.options.min) {
                this.hasError = true;
                this.writeError(`Value must be at least ${this.options.min}`);
                return;
            }

            if (this.options?.max != null && value > this.options.max) {
                this.hasError = true;
                this.writeError(`Value must be at most ${this.options.max}`);
                return;
            }

            this.resolveAndPop(value);
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
            // Only allow digits, and minus at position 0
            for (const ch of data) {
                if (ch >= '0' && ch <= '9') {
                    this.buffer =
                        this.buffer.slice(0, this.cursorPosition) +
                        ch +
                        this.buffer.slice(this.cursorPosition);
                    this.cursorPosition++;
                } else if (ch === '-' && this.cursorPosition === 0 && !this.buffer.startsWith('-')) {
                    this.buffer = '-' + this.buffer;
                    this.cursorPosition++;
                }
                // Ignore other characters
            }
            this.renderLine();
        }
    }

    onResize(): void {
        this.renderLine();
    }

    private buildPrompt(): string {
        const { min, max } = this.options ?? {};
        let hint = '';
        if (min != null && max != null) {
            hint = ` \x1b[2m(${min}–${max})\x1b[0m`;
        } else if (min != null) {
            hint = ` \x1b[2m(min: ${min})\x1b[0m`;
        } else if (max != null) {
            hint = ` \x1b[2m(max: ${max})\x1b[0m`;
        }
        return `\x1b[36m?\x1b[0m ${this.promptText}${hint}`;
    }

    private renderLine(): void {
        const prompt = this.buildPrompt();
        this.redrawLine(prompt, this.buffer, this.cursorPosition);
    }
}

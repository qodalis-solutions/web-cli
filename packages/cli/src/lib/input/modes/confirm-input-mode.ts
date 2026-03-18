import { InputModeHost } from '../input-mode';
import { InputModeBase } from './input-mode-base';

/**
 * Input mode for reading a yes/no confirmation.
 * Shows a hint indicating the default choice (Y/n or y/N).
 * Accepts 'y' or 'n' (case-insensitive). Enter with empty buffer uses the default.
 * All other characters are ignored.
 */
export class ConfirmInputMode extends InputModeBase<boolean> {
    private buffer = '';

    constructor(
        host: InputModeHost,
        resolve: (value: boolean | null) => void,
        private readonly promptText: string,
        private readonly defaultValue: boolean = false,
    ) {
        super(host, resolve);
    }

    activate(): void {
        const hint = this.defaultValue ? '(Y/n)' : '(y/N)';
        const prompt = `\x1b[36m?\x1b[0m ${this.promptText} ${hint}: `;
        this.host.writeToTerminal(prompt);
    }

    async handleInput(data: string): Promise<void> {
        if (data === '\r') {
            if (this.buffer === '') {
                this.resolveAndPop(this.defaultValue);
            } else {
                const lower = this.buffer.toLowerCase();
                if (lower === 'y') {
                    this.resolveAndPop(true);
                } else if (lower === 'n') {
                    this.resolveAndPop(false);
                }
                // If something else was in buffer, ignore and wait
            }
        } else if (data === '\u007F') {
            // Backspace
            if (this.buffer.length > 0) {
                this.buffer = this.buffer.slice(0, -1);
                this.renderLine();
            }
        } else if (data.startsWith('\u001B')) {
            // Ignore escape sequences
        } else {
            const lower = data.toLowerCase();
            if (lower === 'y' || lower === 'n') {
                // Accept only y/n; replace buffer (single char)
                this.buffer = lower;
                this.renderLine();
            }
            // Ignore all other characters
        }
    }

    onResize(): void {
        this.renderLine();
    }

    private renderLine(): void {
        const hint = this.defaultValue ? '(Y/n)' : '(y/N)';
        const prompt = `\x1b[36m?\x1b[0m ${this.promptText} ${hint}: `;
        this.redrawLine(prompt, this.buffer, this.buffer.length);
    }
}

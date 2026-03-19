import { InputModeHost } from '../input-mode';
import { InputModeBase } from './input-mode-base';

/**
 * Input mode for reading a password with masked display.
 * Characters are shown as asterisks. Cursor is always at the end.
 * No validation, placeholder, or default value is supported.
 */
export class PasswordInputMode extends InputModeBase<string> {
    private buffer = '';

    constructor(
        host: InputModeHost,
        resolve: (value: string | null) => void,
        private readonly promptText: string,
    ) {
        super(host, resolve);
    }

    activate(): void {
        const prompt = `\x1b[36m?\x1b[0m ${this.promptText}`;
        this.host.writeToTerminal(prompt);
    }

    async handleInput(data: string): Promise<void> {
        if (data === '\r') {
            this.resolveAndPop(this.buffer);
        } else if (data === '\u007F') {
            // Backspace — remove last character
            if (this.buffer.length > 0) {
                this.buffer = this.buffer.slice(0, -1);
                this.renderLine();
            }
        } else if (data.startsWith('\u001B')) {
            // Ignore all escape sequences (including arrow keys)
        } else {
            const text = data.replace(/[\r\n]+/g, '');
            this.buffer += text;
            // Fast path: just write the mask characters (no cursor repositioning needed)
            if (this.extraLines === 0) {
                this.host.terminal.write('*'.repeat(text.length));
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
        const masked = '*'.repeat(this.buffer.length);
        this.redrawLine(prompt, masked, masked.length);
    }
}

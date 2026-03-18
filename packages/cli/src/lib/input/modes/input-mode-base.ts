import { IInputMode, InputModeHost } from '../input-mode';

/**
 * Abstract base class for all interactive input modes.
 * Provides shared abort handling, resolve/cleanup, line redraw, and help bar rendering.
 *
 * @typeParam T The type of value this mode resolves with.
 */
export abstract class InputModeBase<T> implements IInputMode {
    private _resolved = false;
    /** Whether this mode has already resolved (prevents double-resolve from async operations) */
    protected get isResolved(): boolean { return this._resolved; }
    /** Number of extra lines rendered below the prompt (help bar, error, etc.) */
    protected extraLines = 0;

    constructor(
        protected readonly host: InputModeHost,
        protected readonly resolve: (value: T | null) => void,
    ) {}

    abstract handleInput(data: string): Promise<void>;

    /**
     * Default key event handler. Aborts on Ctrl+C or Escape.
     * Subclasses may override for custom behavior (e.g., search-enabled modes
     * clear the filter first, abort on second press).
     */
    handleKeyEvent(event: KeyboardEvent): boolean {
        if (
            (event.code === 'KeyC' && event.ctrlKey) ||
            event.code === 'Escape'
        ) {
            this.abort();
            return false;
        }
        return true;
    }

    /**
     * Resolve the input promise with a value and pop this mode from the stack.
     */
    resolveAndPop(value: T): void {
        if (this._resolved) return;
        this._resolved = true;
        this.host.terminal.write('\r\n');
        this.host.popMode();
        this.resolve(value);
    }

    /**
     * Abort the input — resolve with null and pop.
     */
    protected abort(): void {
        if (this._resolved) return;
        this._resolved = true;
        this.host.terminal.write('\r\n');
        this.host.popMode();
        this.resolve(null);
    }

    /**
     * Clear the current line and redraw prompt + display text, positioning
     * the cursor at the given position.
     */
    redrawLine(promptText: string, displayText: string, cursorPosition: number): void {
        this.clearExtraLines();
        this.host.terminal.write('\x1b[2K\r');
        this.host.terminal.write(promptText + displayText);
        const cursorOffset = displayText.length - cursorPosition;
        if (cursorOffset > 0) {
            this.host.terminal.write(`\x1b[${cursorOffset}D`);
        }
    }

    /**
     * Render a dimmed help bar below the current line.
     */
    writeHelp(text: string): void {
        this.host.terminal.write(`\r\n    \x1b[2m${text}\x1b[0m`);
        this.extraLines++;
        // Move cursor back up to the input line
        this.host.terminal.write(`\x1b[${this.extraLines}A`);
    }

    /**
     * Write a validation error below the current line.
     */
    protected writeError(message: string): void {
        this.host.terminal.write(`\r\n  \x1b[31m✘ ${message}\x1b[0m`);
        this.extraLines++;
        this.host.terminal.write(`\x1b[${this.extraLines}A`);
    }

    /**
     * Clear any extra lines (help bar, errors) rendered below the prompt.
     */
    protected clearExtraLines(): void {
        if (this.extraLines > 0) {
            this.host.terminal.write('\x1b[s'); // save
            for (let i = 0; i < this.extraLines; i++) {
                this.host.terminal.write('\x1b[B\x1b[2K'); // down + clear
            }
            this.host.terminal.write('\x1b[u'); // restore
            this.extraLines = 0;
        }
    }
}

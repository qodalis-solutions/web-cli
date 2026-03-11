/**
 * Reusable text buffer with cursor management.
 * Eliminates duplicated line-editing logic across CommandLineMode,
 * ReaderMode, and any future input mode.
 */
export class CliLineBuffer {
    private _text = '';
    private _cursorPosition = 0;

    get text(): string {
        return this._text;
    }

    get cursorPosition(): number {
        return this._cursorPosition;
    }

    set cursorPosition(value: number) {
        this._cursorPosition = Math.max(0, Math.min(value, this._text.length));
    }

    insert(str: string): void {
        this._text =
            this._text.slice(0, this._cursorPosition) +
            str +
            this._text.slice(this._cursorPosition);
        this._cursorPosition += str.length;
    }

    deleteCharBefore(): void {
        if (this._cursorPosition > 0) {
            this._text =
                this._text.slice(0, this._cursorPosition - 1) +
                this._text.slice(this._cursorPosition);
            this._cursorPosition--;
        }
    }

    deleteCharAt(): void {
        if (this._cursorPosition < this._text.length) {
            this._text =
                this._text.slice(0, this._cursorPosition) +
                this._text.slice(this._cursorPosition + 1);
        }
    }

    moveCursorLeft(): void {
        if (this._cursorPosition > 0) {
            this._cursorPosition--;
        }
    }

    moveCursorRight(): void {
        if (this._cursorPosition < this._text.length) {
            this._cursorPosition++;
        }
    }

    moveHome(): void {
        this._cursorPosition = 0;
    }

    moveEnd(): void {
        this._cursorPosition = this._text.length;
    }

    clear(): void {
        this._text = '';
        this._cursorPosition = 0;
    }

    setText(str: string): void {
        this._text = str;
        this._cursorPosition = str.length;
    }
}

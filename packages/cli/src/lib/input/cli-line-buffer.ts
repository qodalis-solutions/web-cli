/**
 * Reusable text buffer with cursor management.
 * Eliminates duplicated line-editing logic across CommandLineMode,
 * LineInputMode, and any future input mode.
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

    /** Remove the text before the cursor (Ctrl+U); returns it */
    deleteToStart(): string {
        const removed = this._text.slice(0, this._cursorPosition);
        this._text = this._text.slice(this._cursorPosition);
        this._cursorPosition = 0;
        return removed;
    }

    /** Remove the text from the cursor to the end (Ctrl+K); returns it */
    deleteToEnd(): string {
        const removed = this._text.slice(this._cursorPosition);
        this._text = this._text.slice(0, this._cursorPosition);
        return removed;
    }

    /** Remove the whitespace-delimited word before the cursor (Ctrl+W); returns it */
    deleteWordBefore(): string {
        let start = this._cursorPosition;
        while (start > 0 && /\s/.test(this._text[start - 1])) start--;
        while (start > 0 && !/\s/.test(this._text[start - 1])) start--;
        const removed = this._text.slice(start, this._cursorPosition);
        this._text = this._text.slice(0, start) + this._text.slice(this._cursorPosition);
        this._cursorPosition = start;
        return removed;
    }
}

/** Text removed by the last kill key (Ctrl+U/K/W), pasted back by Ctrl+Y */
export interface CliKillRing {
    text: string;
}

const HOME_KEYS = ['\u0001', '\u001b[H', '\u001bOH', '\u001b[1~', '\u001b[7~'];
const END_KEYS = ['\u0005', '\u001b[F', '\u001bOF', '\u001b[4~', '\u001b[8~'];
const DELETE_KEYS = ['\u001b[3~', '\u0004'];

/**
 * The readline editing keys every line editor shares: Home/End and Ctrl+A/E,
 * Delete and Ctrl+D, Ctrl+U/K (kill to start/end), Ctrl+W and Alt+Backspace
 * (kill the previous word), Ctrl+Y (paste the last kill).
 * Returns true when `data` was one of them (the buffer may be unchanged).
 */
export function applyEditingKey(buffer: CliLineBuffer, data: string, killRing: CliKillRing): boolean {
    if (HOME_KEYS.includes(data)) {
        buffer.moveHome();
    } else if (END_KEYS.includes(data)) {
        buffer.moveEnd();
    } else if (DELETE_KEYS.includes(data)) {
        buffer.deleteCharAt();
    } else if (data === '\u0015') {
        killRing.text = buffer.deleteToStart() || killRing.text;
    } else if (data === '\u000b') {
        killRing.text = buffer.deleteToEnd() || killRing.text;
    } else if (data === '\u0017' || data === '\u001b\u007f') {
        killRing.text = buffer.deleteWordBefore() || killRing.text;
    } else if (data === '\u0019') {
        if (killRing.text) buffer.insert(killRing.text);
    } else {
        return false;
    }
    return true;
}

/** A terminal key sequence (CSI or SS3) that is not text */
export function isEscapeSequence(data: string): boolean {
    return /^\u001b(\[[0-9;?]*[~A-Za-z]|O[A-Za-z])$/.test(data);
}

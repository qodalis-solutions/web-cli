import { CliDateOptions } from '@qodalis/cli-core';
import { InputModeHost } from '../input-mode';
import { InputModeBase } from './input-mode-base';

/**
 * Input mode for reading a date string with format validation.
 * Supports YYYY, MM, DD tokens with configurable separators.
 * Validates calendar correctness (including leap years) and optional min/max range.
 */
export class DateInputMode extends InputModeBase<string> {
    private buffer: string;
    private cursorPosition: number;
    private hasError = false;
    private readonly format: string;
    private readonly separator: string;

    constructor(
        host: InputModeHost,
        resolve: (value: string | null) => void,
        private readonly promptText: string,
        private readonly options?: CliDateOptions,
    ) {
        super(host, resolve);
        this.format = options?.format ?? 'YYYY-MM-DD';
        this.separator = this.extractSeparator(this.format);
        this.buffer = options?.default ?? '';
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
            const error = this.validateBuffer();
            if (error) {
                this.hasError = true;
                this.writeError(error);
                return;
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
            for (const ch of data) {
                if ((ch >= '0' && ch <= '9') || ch === this.separator) {
                    this.buffer =
                        this.buffer.slice(0, this.cursorPosition) +
                        ch +
                        this.buffer.slice(this.cursorPosition);
                    this.cursorPosition++;
                }
                // Ignore all other characters
            }
            this.renderLine();
        }
    }

    onResize(): void {
        this.renderLine();
    }

    private buildPrompt(): string {
        return `\x1b[36m?\x1b[0m ${this.promptText} \x1b[2m(${this.format})\x1b[0m`;
    }

    private renderLine(): void {
        const prompt = this.buildPrompt();
        this.redrawLine(prompt, this.buffer, this.cursorPosition);
    }

    /**
     * Extract the separator character from a format string.
     * Returns the first non-alphabetic character found (e.g., '-' from 'YYYY-MM-DD').
     * Defaults to '-' if none is found.
     */
    private extractSeparator(format: string): string {
        for (const ch of format) {
            if (ch < 'A' || ch > 'z' || (ch > 'Z' && ch < 'a')) {
                return ch;
            }
        }
        return '-';
    }

    /**
     * Parse the buffer according to the current format string.
     * Returns { year, month, day } or null if parsing fails.
     */
    private parseBuffer(): { year: number; month: number; day: number } | null {
        const parts = this.buffer.split(this.separator);
        const formatParts = this.format.split(this.separator);

        if (parts.length !== formatParts.length) return null;

        let year = 0, month = 0, day = 0;

        for (let i = 0; i < formatParts.length; i++) {
            const token = formatParts[i].toUpperCase();
            const value = parseInt(parts[i], 10);
            if (isNaN(value)) return null;

            if (token === 'YYYY') year = value;
            else if (token === 'MM') month = value;
            else if (token === 'DD') day = value;
        }

        return { year, month, day };
    }

    /**
     * Validate the buffer as a real calendar date.
     * Returns an error message string or null if valid.
     */
    private validateBuffer(): string | null {
        if (!this.buffer) {
            return `Please enter a date in ${this.format} format`;
        }

        const parsed = this.parseBuffer();
        if (!parsed) {
            return `Invalid date format, expected ${this.format}`;
        }

        const { year, month, day } = parsed;

        if (month < 1 || month > 12) {
            return 'Month must be between 1 and 12';
        }

        const maxDay = this.daysInMonth(year, month);
        if (day < 1 || day > maxDay) {
            return `Day must be between 1 and ${maxDay} for the given month`;
        }

        // Min/max validation
        if (this.options?.min) {
            const minDate = this.parseDate(this.options.min);
            const current = new Date(year, month - 1, day);
            if (minDate && current < minDate) {
                return `Date must not be before ${this.options.min}`;
            }
        }

        if (this.options?.max) {
            const maxDate = this.parseDate(this.options.max);
            const current = new Date(year, month - 1, day);
            if (maxDate && current > maxDate) {
                return `Date must not be after ${this.options.max}`;
            }
        }

        return null;
    }

    /**
     * Returns the number of days in a given month (accounting for leap years).
     */
    private daysInMonth(year: number, month: number): number {
        // Day 0 of the next month = last day of the current month
        return new Date(year, month, 0).getDate();
    }

    /**
     * Parse a date string (in the same format as this mode) into a Date object.
     */
    private parseDate(dateStr: string): Date | null {
        const parts = dateStr.split(this.separator);
        const formatParts = this.format.split(this.separator);

        if (parts.length !== formatParts.length) return null;

        let year = 0, month = 0, day = 0;

        for (let i = 0; i < formatParts.length; i++) {
            const token = formatParts[i].toUpperCase();
            const value = parseInt(parts[i], 10);
            if (isNaN(value)) return null;

            if (token === 'YYYY') year = value;
            else if (token === 'MM') month = value;
            else if (token === 'DD') day = value;
        }

        return new Date(year, month - 1, day);
    }
}

import { Terminal } from '@xterm/xterm';
import { IInputMode } from './input-mode';
import { ActiveInputRequest } from '../services/cli-input-reader';

/**
 * Host interface for ReaderMode — provides access to the active input request.
 */
export interface ReaderModeHost {
    readonly terminal: Terminal;
    getActiveInputRequest(): ActiveInputRequest | null;
    setActiveInputRequest(request: ActiveInputRequest | null): void;
    popMode(): void;
}

/**
 * Input mode for interactive reader prompts (readLine, readPassword,
 * readConfirm, readSelect). Pushed on top of CommandLineMode when
 * a reader request starts, pops itself when the request completes.
 */
export class ReaderMode implements IInputMode {
    constructor(private readonly host: ReaderModeHost) {}

    async handleInput(data: string): Promise<void> {
        const request = this.host.getActiveInputRequest();
        if (!request) {
            return;
        }

        switch (request.type) {
            case 'line':
                this.handleLineInput(request, data);
                break;
            case 'password':
                this.handlePasswordInput(request, data);
                break;
            case 'confirm':
                this.handleConfirmInput(request, data);
                break;
            case 'select':
                this.handleSelectInput(request, data);
                break;
            case 'select-inline':
                this.handleSelectInlineInput(request, data);
                break;
            case 'multi-select':
                this.handleMultiSelectInput(request, data);
                break;
            case 'number':
                this.handleNumberInput(request, data);
                break;
        }
    }

    handleKeyEvent(event: KeyboardEvent): boolean {
        if (event.code === 'KeyC' && event.ctrlKey) {
            const request = this.host.getActiveInputRequest();
            if (request) {
                request.resolve(null);
                this.host.setActiveInputRequest(null);
                this.host.terminal.writeln('');
                this.host.popMode();
            }
            return false;
        }

        if (event.code === 'Escape') {
            const request = this.host.getActiveInputRequest();
            if (request) {
                request.resolve(null);
                this.host.setActiveInputRequest(null);
                this.host.terminal.writeln('');
                this.host.popMode();
            }
            return false;
        }

        return true;
    }

    private handleLineInput(request: ActiveInputRequest, data: string): void {
        if (data === '\r') {
            this.host.terminal.write('\r\n');
            const value = request.buffer;
            this.host.setActiveInputRequest(null);
            this.host.popMode();
            request.resolve(value);
        } else if (data === '\u007F') {
            if (request.cursorPosition > 0) {
                request.buffer =
                    request.buffer.slice(0, request.cursorPosition - 1) +
                    request.buffer.slice(request.cursorPosition);
                request.cursorPosition--;
                this.redrawReaderLine(request, request.buffer);
            }
        } else if (data === '\u001B[D') {
            if (request.cursorPosition > 0) {
                request.cursorPosition--;
                this.host.terminal.write(data);
            }
        } else if (data === '\u001B[C') {
            if (request.cursorPosition < request.buffer.length) {
                request.cursorPosition++;
                this.host.terminal.write(data);
            }
        } else if (data.startsWith('\u001B')) {
            // Ignore other escape sequences
        } else {
            const text = data.replace(/[\r\n]+/g, '');
            request.buffer =
                request.buffer.slice(0, request.cursorPosition) +
                text +
                request.buffer.slice(request.cursorPosition);
            request.cursorPosition += text.length;
            this.redrawReaderLine(request, request.buffer);
        }
    }

    private handlePasswordInput(
        request: ActiveInputRequest,
        data: string,
    ): void {
        if (data === '\r') {
            this.host.terminal.write('\r\n');
            const value = request.buffer;
            this.host.setActiveInputRequest(null);
            this.host.popMode();
            request.resolve(value);
        } else if (data === '\u007F') {
            if (request.cursorPosition > 0) {
                request.buffer =
                    request.buffer.slice(0, request.cursorPosition - 1) +
                    request.buffer.slice(request.cursorPosition);
                request.cursorPosition--;
                this.redrawReaderLine(
                    request,
                    '*'.repeat(request.buffer.length),
                );
            }
        } else if (data.startsWith('\u001B')) {
            // Ignore all escape sequences for password
        } else {
            const text = data.replace(/[\r\n]+/g, '');
            request.buffer =
                request.buffer.slice(0, request.cursorPosition) +
                text +
                request.buffer.slice(request.cursorPosition);
            request.cursorPosition += text.length;
            this.redrawReaderLine(request, '*'.repeat(request.buffer.length));
        }
    }

    private handleConfirmInput(
        request: ActiveInputRequest,
        data: string,
    ): void {
        if (data === '\r') {
            this.host.terminal.write('\r\n');
            this.host.setActiveInputRequest(null);
            this.host.popMode();
            const buf = request.buffer.toLowerCase();
            if (buf === 'y') {
                request.resolve(true);
            } else if (buf === 'n') {
                request.resolve(false);
            } else {
                request.resolve(request.defaultValue ?? false);
            }
        } else if (data === '\u007F') {
            if (request.cursorPosition > 0) {
                request.buffer = request.buffer.slice(0, -1);
                request.cursorPosition--;
                this.redrawReaderLine(request, request.buffer);
            }
        } else if (data.startsWith('\u001B')) {
            // Ignore escape sequences
        } else {
            const char = data.toLowerCase();
            if (char === 'y' || char === 'n') {
                request.buffer = data;
                request.cursorPosition = 1;
                this.redrawReaderLine(request, request.buffer);
            }
        }
    }

    private handleSelectInput(request: ActiveInputRequest, data: string): void {
        const options = request.options!;
        const selectedIndex = request.selectedIndex!;

        if (data === '\r') {
            this.host.terminal.write('\r\n');
            this.host.setActiveInputRequest(null);
            this.host.popMode();
            request.resolve(options[selectedIndex].value);
        } else if (data === '\u001B[A') {
            if (selectedIndex > 0) {
                request.selectedIndex = selectedIndex - 1;
                this.adjustScrollOffset(request);
                this.redrawSelectOptions(request);
                request.onChange?.(options[request.selectedIndex!].value);
            }
        } else if (data === '\u001B[B') {
            if (selectedIndex < options.length - 1) {
                request.selectedIndex = selectedIndex + 1;
                this.adjustScrollOffset(request);
                this.redrawSelectOptions(request);
                request.onChange?.(options[request.selectedIndex!].value);
            }
        }
    }

    private adjustScrollOffset(request: ActiveInputRequest): void {
        const options = request.options!;
        const maxVisible = request.maxVisible ?? options.length;
        const needsScroll = options.length > maxVisible;
        const itemSlots = needsScroll ? maxVisible - 2 : options.length;
        const visibleCount = Math.max(1, Math.min(itemSlots, options.length));
        const scrollOffset = request.scrollOffset ?? 0;
        const selectedIndex = request.selectedIndex!;

        if (selectedIndex < scrollOffset) {
            request.scrollOffset = selectedIndex;
        } else if (selectedIndex >= scrollOffset + visibleCount) {
            request.scrollOffset = selectedIndex - visibleCount + 1;
        }
    }

    private redrawReaderLine(
        request: ActiveInputRequest,
        displayText: string,
    ): void {
        this.host.terminal.write('\x1b[2K\r');
        this.host.terminal.write(request.promptText + displayText);

        const cursorOffset = request.buffer.length - request.cursorPosition;
        if (cursorOffset > 0) {
            this.host.terminal.write(`\x1b[${cursorOffset}D`);
        }
    }

    private redrawSelectOptions(request: ActiveInputRequest): void {
        const options = request.options!;
        const selectedIndex = request.selectedIndex!;
        const maxVisible = request.maxVisible ?? options.length;
        const scrollOffset = request.scrollOffset ?? 0;
        const displayLines = request.displayLines ?? options.length;
        const needsScroll = options.length > maxVisible;
        const itemSlots = needsScroll ? maxVisible - 2 : options.length;
        const visibleCount = Math.max(1, Math.min(itemSlots, options.length));
        const end = Math.min(scrollOffset + visibleCount, options.length);

        // Move cursor up to the start of the rendered block
        if (displayLines > 0) {
            this.host.terminal.write(`\x1b[${displayLines}A`);
        }

        if (needsScroll) {
            this.host.terminal.write('\x1b[2K\r');
            const upLabel = scrollOffset > 0 ? '↑ more' : '';
            this.host.terminal.write(`    \x1b[2m${upLabel}\x1b[0m\r\n`);
        }

        for (let i = scrollOffset; i < end; i++) {
            this.host.terminal.write('\x1b[2K\r');
            const prefix = i === selectedIndex ? '  \x1b[36m> ' : '    ';
            const suffix = i === selectedIndex ? '\x1b[0m' : '';
            this.host.terminal.write(
                `${prefix}${options[i].label}${suffix}\r\n`,
            );
        }

        if (needsScroll) {
            this.host.terminal.write('\x1b[2K\r');
            const downLabel = end < options.length ? '↓ more' : '';
            this.host.terminal.write(`    \x1b[2m${downLabel}\x1b[0m\r\n`);
        }
    }

    private handleSelectInlineInput(
        request: ActiveInputRequest,
        data: string,
    ): void {
        const options = request.options!;
        const selectedIndex = request.selectedIndex!;

        if (data === '\r') {
            this.host.terminal.write('\r\n');
            this.host.setActiveInputRequest(null);
            this.host.popMode();
            request.resolve(options[selectedIndex].value);
        } else if (data === '\u001B[D') {
            // Left arrow
            if (selectedIndex > 0) {
                request.selectedIndex = selectedIndex - 1;
                this.redrawInlineSelectOptions(request);
                request.onChange?.(options[request.selectedIndex!].value);
            }
        } else if (data === '\u001B[C') {
            // Right arrow
            if (selectedIndex < options.length - 1) {
                request.selectedIndex = selectedIndex + 1;
                this.redrawInlineSelectOptions(request);
                request.onChange?.(options[request.selectedIndex!].value);
            }
        }
        // Ignore Up/Down arrows and other input
    }

    private redrawInlineSelectOptions(request: ActiveInputRequest): void {
        const options = request.options!;
        const selectedIndex = request.selectedIndex!;

        this.host.terminal.write('\x1b[2K\r');
        const inlineText = options
            .map((opt, i) => {
                if (i === selectedIndex) {
                    return `\x1b[36m[ ${opt.label} ]\x1b[0m`;
                }
                return `  ${opt.label}  `;
            })
            .join('');
        this.host.terminal.write(`${request.promptText} ${inlineText}`);
    }

    private handleMultiSelectInput(
        request: ActiveInputRequest,
        data: string,
    ): void {
        const options = request.options!;
        const selectedIndex = request.selectedIndex!;
        const checkedIndices = request.checkedIndices!;

        if (data === '\r') {
            this.host.terminal.write('\r\n');
            this.host.setActiveInputRequest(null);
            this.host.popMode();
            const selected = options
                .filter((_, i) => checkedIndices.has(i))
                .map((opt) => opt.value);
            request.resolve(selected);
        } else if (data === ' ') {
            // Toggle checkbox
            if (checkedIndices.has(selectedIndex)) {
                checkedIndices.delete(selectedIndex);
            } else {
                checkedIndices.add(selectedIndex);
            }
            this.redrawMultiSelectOptions(request);
        } else if (data === '\u001B[A') {
            // Up arrow
            if (selectedIndex > 0) {
                request.selectedIndex = selectedIndex - 1;
                this.adjustScrollOffset(request);
                this.redrawMultiSelectOptions(request);
            }
        } else if (data === '\u001B[B') {
            // Down arrow
            if (selectedIndex < options.length - 1) {
                request.selectedIndex = selectedIndex + 1;
                this.adjustScrollOffset(request);
                this.redrawMultiSelectOptions(request);
            }
        }
        // Ignore Left/Right arrows and other input
    }

    private redrawMultiSelectOptions(request: ActiveInputRequest): void {
        const options = request.options!;
        const selectedIndex = request.selectedIndex!;
        const checkedIndices = request.checkedIndices!;
        const maxVisible = request.maxVisible ?? options.length;
        const scrollOffset = request.scrollOffset ?? 0;
        const displayLines = request.displayLines ?? options.length;
        const needsScroll = options.length > maxVisible;
        const itemSlots = needsScroll ? maxVisible - 2 : options.length;
        const visibleCount = Math.max(1, Math.min(itemSlots, options.length));
        const end = Math.min(scrollOffset + visibleCount, options.length);

        if (displayLines > 0) {
            this.host.terminal.write(`\x1b[${displayLines}A`);
        }

        if (needsScroll) {
            this.host.terminal.write('\x1b[2K\r');
            const upLabel = scrollOffset > 0 ? '↑ more' : '';
            this.host.terminal.write(`    \x1b[2m${upLabel}\x1b[0m\r\n`);
        }

        for (let i = scrollOffset; i < end; i++) {
            this.host.terminal.write('\x1b[2K\r');
            const checkbox = checkedIndices.has(i) ? '[x]' : '[ ]';
            const prefix =
                i === selectedIndex
                    ? `  \x1b[36m> ${checkbox} `
                    : `    ${checkbox} `;
            const suffix = i === selectedIndex ? '\x1b[0m' : '';
            this.host.terminal.write(
                `${prefix}${options[i].label}${suffix}\r\n`,
            );
        }

        if (needsScroll) {
            this.host.terminal.write('\x1b[2K\r');
            const downLabel = end < options.length ? '↓ more' : '';
            this.host.terminal.write(`    \x1b[2m${downLabel}\x1b[0m\r\n`);
        }
    }

    private handleNumberInput(request: ActiveInputRequest, data: string): void {
        if (data === '\r') {
            const numOptions = request.numberOptions;
            if (request.buffer === '') {
                // Use default if available
                if (numOptions?.default !== undefined) {
                    this.host.terminal.write('\r\n');
                    this.host.setActiveInputRequest(null);
                    this.host.popMode();
                    request.resolve(numOptions.default);
                } else {
                    // No input and no default — stay active, show error
                    this.host.terminal.write('\r\n');
                    this.host.terminal.write(
                        '\x1b[31mPlease enter a number.\x1b[0m\r\n',
                    );
                    this.host.terminal.write(request.promptText);
                }
                return;
            }

            const value = Number(request.buffer);
            if (isNaN(value)) {
                this.host.terminal.write('\r\n');
                this.host.terminal.write('\x1b[31mInvalid number.\x1b[0m\r\n');
                request.buffer = '';
                request.cursorPosition = 0;
                this.host.terminal.write(request.promptText);
                return;
            }

            if (numOptions?.min !== undefined && value < numOptions.min) {
                this.host.terminal.write('\r\n');
                this.host.terminal.write(
                    `\x1b[31mValue must be at least ${numOptions.min}.\x1b[0m\r\n`,
                );
                request.buffer = '';
                request.cursorPosition = 0;
                this.host.terminal.write(request.promptText);
                return;
            }

            if (numOptions?.max !== undefined && value > numOptions.max) {
                this.host.terminal.write('\r\n');
                this.host.terminal.write(
                    `\x1b[31mValue must be at most ${numOptions.max}.\x1b[0m\r\n`,
                );
                request.buffer = '';
                request.cursorPosition = 0;
                this.host.terminal.write(request.promptText);
                return;
            }

            this.host.terminal.write('\r\n');
            this.host.setActiveInputRequest(null);
            this.host.popMode();
            request.resolve(value);
        } else if (data === '\u007F') {
            // Backspace
            if (request.cursorPosition > 0) {
                request.buffer =
                    request.buffer.slice(0, request.cursorPosition - 1) +
                    request.buffer.slice(request.cursorPosition);
                request.cursorPosition--;
                this.redrawReaderLine(request, request.buffer);
            }
        } else if (data === '-') {
            // Only allow minus at the start
            if (request.cursorPosition === 0 && !request.buffer.includes('-')) {
                request.buffer = '-' + request.buffer;
                request.cursorPosition = 1;
                this.redrawReaderLine(request, request.buffer);
            }
        } else if (/^\d$/.test(data)) {
            request.buffer =
                request.buffer.slice(0, request.cursorPosition) +
                data +
                request.buffer.slice(request.cursorPosition);
            request.cursorPosition += 1;
            this.redrawReaderLine(request, request.buffer);
        }
        // Ignore all other input (letters, escape sequences, etc.)
    }
}

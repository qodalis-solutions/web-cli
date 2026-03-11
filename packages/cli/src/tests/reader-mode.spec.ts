import { ReaderMode, ReaderModeHost } from '../lib/input/reader-mode';
import { ActiveInputRequest } from '../lib/services/cli-input-reader';

class MockTerminal {
    written: string[] = [];

    write(data: string): void {
        this.written.push(data);
    }

    writeln(data: string): void {
        this.written.push(data + '\n');
    }
}

class MockReaderModeHost implements ReaderModeHost {
    terminal = new MockTerminal() as any;
    private _activeRequest: ActiveInputRequest | null = null;
    poppedMode = false;

    getActiveInputRequest(): ActiveInputRequest | null {
        return this._activeRequest;
    }

    setActiveInputRequest(request: ActiveInputRequest | null): void {
        this._activeRequest = request;
    }

    popMode(): void {
        this.poppedMode = true;
    }

    reset(): void {
        this._activeRequest = null;
        this.poppedMode = false;
        this.terminal.written = [];
    }
}

function createSelectRequest(
    options: { label: string; value: string }[],
    onChange?: (value: string) => void,
): { request: ActiveInputRequest; resolvedValue: Promise<string | null> } {
    let resolvePromise: (value: string | null) => void;
    const resolvedValue = new Promise<string | null>((resolve) => {
        resolvePromise = resolve;
    });

    const request: ActiveInputRequest = {
        type: 'select',
        promptText: 'Pick one:',
        resolve: (value: any) => resolvePromise(value),
        buffer: '',
        cursorPosition: 0,
        options,
        selectedIndex: 0,
        onChange,
    };

    return { request, resolvedValue };
}

function createSelectInlineRequest(
    options: { label: string; value: string }[],
    onChange?: (value: string) => void,
): { request: ActiveInputRequest; resolvedValue: Promise<string | null> } {
    let resolvePromise: (value: string | null) => void;
    const resolvedValue = new Promise<string | null>((resolve) => {
        resolvePromise = resolve;
    });

    const request: ActiveInputRequest = {
        type: 'select-inline',
        promptText: 'Pick one:',
        resolve: (value: any) => resolvePromise(value),
        buffer: '',
        cursorPosition: 0,
        options,
        selectedIndex: 0,
        onChange,
    };

    return { request, resolvedValue };
}

function createMultiSelectRequest(
    options: { label: string; value: string }[],
    checkedIndices?: Set<number>,
): { request: ActiveInputRequest; resolvedValue: Promise<string[] | null> } {
    let resolvePromise: (value: string[] | null) => void;
    const resolvedValue = new Promise<string[] | null>((resolve) => {
        resolvePromise = resolve;
    });

    const request: ActiveInputRequest = {
        type: 'multi-select',
        promptText: 'Select items:',
        resolve: (value: any) => resolvePromise(value),
        buffer: '',
        cursorPosition: 0,
        options,
        selectedIndex: 0,
        checkedIndices: checkedIndices ?? new Set<number>(),
    };

    return { request, resolvedValue };
}

function createNumberRequest(numberOptions?: {
    min?: number;
    max?: number;
    default?: number;
}): { request: ActiveInputRequest; resolvedValue: Promise<number | null> } {
    let resolvePromise: (value: number | null) => void;
    const resolvedValue = new Promise<number | null>((resolve) => {
        resolvePromise = resolve;
    });

    const request: ActiveInputRequest = {
        type: 'number',
        promptText: 'Enter number: ',
        resolve: (value: any) => resolvePromise(value),
        buffer: '',
        cursorPosition: 0,
        numberOptions,
    };

    return { request, resolvedValue };
}

describe('ReaderMode', () => {
    let host: MockReaderModeHost;
    let mode: ReaderMode;

    const options = [
        { label: 'Option A', value: 'a' },
        { label: 'Option B', value: 'b' },
        { label: 'Option C', value: 'c' },
    ];

    beforeEach(() => {
        host = new MockReaderModeHost();
        mode = new ReaderMode(host);
    });

    describe('handleSelectInput', () => {
        it('should call onChange when arrow down is pressed', async () => {
            const onChange = jasmine.createSpy('onChange');
            const { request } = createSelectRequest(options, onChange);
            host.setActiveInputRequest(request);

            await mode.handleInput('\u001B[B'); // Arrow Down

            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith('b');
            expect(request.selectedIndex).toBe(1);
        });

        it('should call onChange when arrow up is pressed after moving down', async () => {
            const onChange = jasmine.createSpy('onChange');
            const { request } = createSelectRequest(options, onChange);
            request.selectedIndex = 1; // Start at option B
            host.setActiveInputRequest(request);

            await mode.handleInput('\u001B[A'); // Arrow Up

            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith('a');
            expect(request.selectedIndex).toBe(0);
        });

        it('should not call onChange when arrow up at top of list', async () => {
            const onChange = jasmine.createSpy('onChange');
            const { request } = createSelectRequest(options, onChange);
            host.setActiveInputRequest(request);

            await mode.handleInput('\u001B[A'); // Arrow Up at index 0

            expect(onChange).not.toHaveBeenCalled();
            expect(request.selectedIndex).toBe(0);
        });

        it('should not call onChange when arrow down at bottom of list', async () => {
            const onChange = jasmine.createSpy('onChange');
            const { request } = createSelectRequest(options, onChange);
            request.selectedIndex = 2; // At last option
            host.setActiveInputRequest(request);

            await mode.handleInput('\u001B[B'); // Arrow Down at last index

            expect(onChange).not.toHaveBeenCalled();
            expect(request.selectedIndex).toBe(2);
        });

        it('should resolve with selected value on Enter', async () => {
            const onChange = jasmine.createSpy('onChange');
            const { request, resolvedValue } = createSelectRequest(
                options,
                onChange,
            );
            request.selectedIndex = 1; // Option B
            host.setActiveInputRequest(request);

            await mode.handleInput('\r'); // Enter

            const result = await resolvedValue;
            expect(result).toBe('b');
            expect(host.poppedMode).toBe(true);
            expect(onChange).not.toHaveBeenCalled();
        });

        it('should navigate through all options with arrow down', async () => {
            const onChange = jasmine.createSpy('onChange');
            const { request } = createSelectRequest(options, onChange);
            host.setActiveInputRequest(request);

            await mode.handleInput('\u001B[B'); // Down to B
            await mode.handleInput('\u001B[B'); // Down to C

            expect(onChange).toHaveBeenCalledTimes(2);
            expect(onChange.calls.argsFor(0)).toEqual(['b']);
            expect(onChange.calls.argsFor(1)).toEqual(['c']);
            expect(request.selectedIndex).toBe(2);
        });

        it('should work without onChange callback', async () => {
            const { request } = createSelectRequest(options); // no onChange
            host.setActiveInputRequest(request);

            // Should not throw
            await mode.handleInput('\u001B[B');
            expect(request.selectedIndex).toBe(1);
        });
    });

    describe('handleKeyEvent - abort paths', () => {
        it('should resolve with null on Ctrl+C', () => {
            const onChange = jasmine.createSpy('onChange');
            const { request } = createSelectRequest(options, onChange);
            host.setActiveInputRequest(request);

            const event = new KeyboardEvent('keydown', {
                code: 'KeyC',
                ctrlKey: true,
            });
            const result = mode.handleKeyEvent(event);

            expect(result).toBe(false);
            expect(host.poppedMode).toBe(true);
            expect(host.getActiveInputRequest()).toBeNull();
        });

        it('should resolve with null on Escape', () => {
            const onChange = jasmine.createSpy('onChange');
            const { request } = createSelectRequest(options, onChange);
            host.setActiveInputRequest(request);

            const event = new KeyboardEvent('keydown', { code: 'Escape' });
            const result = mode.handleKeyEvent(event);

            expect(result).toBe(false);
            expect(host.poppedMode).toBe(true);
            expect(host.getActiveInputRequest()).toBeNull();
        });

        it('should return true for other key events', () => {
            const { request } = createSelectRequest(options);
            host.setActiveInputRequest(request);

            const event = new KeyboardEvent('keydown', { code: 'KeyA' });
            const result = mode.handleKeyEvent(event);

            expect(result).toBe(true);
            expect(host.poppedMode).toBe(false);
        });
    });

    describe('handleInput with no active request', () => {
        it('should do nothing when no request is active', async () => {
            // No request set
            await mode.handleInput('\r');
            expect(host.poppedMode).toBe(false);
        });
    });

    describe('handleSelectInlineInput', () => {
        it('should navigate right with Right arrow', async () => {
            const onChange = jasmine.createSpy('onChange');
            const { request } = createSelectInlineRequest(options, onChange);
            host.setActiveInputRequest(request);

            await mode.handleInput('\u001B[C'); // Right arrow

            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith('b');
            expect(request.selectedIndex).toBe(1);
        });

        it('should navigate left with Left arrow', async () => {
            const onChange = jasmine.createSpy('onChange');
            const { request } = createSelectInlineRequest(options, onChange);
            request.selectedIndex = 2;
            host.setActiveInputRequest(request);

            await mode.handleInput('\u001B[D'); // Left arrow

            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith('b');
            expect(request.selectedIndex).toBe(1);
        });

        it('should fire onChange on each arrow press', async () => {
            const onChange = jasmine.createSpy('onChange');
            const { request } = createSelectInlineRequest(options, onChange);
            host.setActiveInputRequest(request);

            await mode.handleInput('\u001B[C'); // Right to B
            await mode.handleInput('\u001B[C'); // Right to C

            expect(onChange).toHaveBeenCalledTimes(2);
            expect(onChange.calls.argsFor(0)).toEqual(['b']);
            expect(onChange.calls.argsFor(1)).toEqual(['c']);
        });

        it('should not move past start (index 0)', async () => {
            const onChange = jasmine.createSpy('onChange');
            const { request } = createSelectInlineRequest(options, onChange);
            host.setActiveInputRequest(request);

            await mode.handleInput('\u001B[D'); // Left at index 0

            expect(onChange).not.toHaveBeenCalled();
            expect(request.selectedIndex).toBe(0);
        });

        it('should not move past end', async () => {
            const onChange = jasmine.createSpy('onChange');
            const { request } = createSelectInlineRequest(options, onChange);
            request.selectedIndex = 2;
            host.setActiveInputRequest(request);

            await mode.handleInput('\u001B[C'); // Right at last index

            expect(onChange).not.toHaveBeenCalled();
            expect(request.selectedIndex).toBe(2);
        });

        it('should resolve with selected value on Enter', async () => {
            const { request, resolvedValue } =
                createSelectInlineRequest(options);
            request.selectedIndex = 1;
            host.setActiveInputRequest(request);

            await mode.handleInput('\r');

            const result = await resolvedValue;
            expect(result).toBe('b');
            expect(host.poppedMode).toBe(true);
        });

        it('should work without onChange callback', async () => {
            const { request } = createSelectInlineRequest(options);
            host.setActiveInputRequest(request);

            await mode.handleInput('\u001B[C');
            expect(request.selectedIndex).toBe(1);
        });

        it('should ignore Up/Down arrows', async () => {
            const onChange = jasmine.createSpy('onChange');
            const { request } = createSelectInlineRequest(options, onChange);
            host.setActiveInputRequest(request);

            await mode.handleInput('\u001B[A'); // Up
            await mode.handleInput('\u001B[B'); // Down

            expect(onChange).not.toHaveBeenCalled();
            expect(request.selectedIndex).toBe(0);
        });
    });

    describe('handleMultiSelectInput', () => {
        it('should navigate down with Down arrow', async () => {
            const { request } = createMultiSelectRequest(options);
            host.setActiveInputRequest(request);

            await mode.handleInput('\u001B[B'); // Down

            expect(request.selectedIndex).toBe(1);
        });

        it('should navigate up with Up arrow', async () => {
            const { request } = createMultiSelectRequest(options);
            request.selectedIndex = 2;
            host.setActiveInputRequest(request);

            await mode.handleInput('\u001B[A'); // Up

            expect(request.selectedIndex).toBe(1);
        });

        it('should toggle item on with Space', async () => {
            const { request } = createMultiSelectRequest(options);
            host.setActiveInputRequest(request);

            await mode.handleInput(' '); // Space to toggle index 0

            expect(request.checkedIndices!.has(0)).toBe(true);
        });

        it('should toggle item off with Space', async () => {
            const checkedIndices = new Set([0, 1]);
            const { request } = createMultiSelectRequest(
                options,
                checkedIndices,
            );
            host.setActiveInputRequest(request);

            await mode.handleInput(' '); // Space to untoggle index 0

            expect(request.checkedIndices!.has(0)).toBe(false);
            expect(request.checkedIndices!.has(1)).toBe(true);
        });

        it('should resolve with array of checked values on Enter', async () => {
            const checkedIndices = new Set([0, 2]);
            const { request, resolvedValue } = createMultiSelectRequest(
                options,
                checkedIndices,
            );
            host.setActiveInputRequest(request);

            await mode.handleInput('\r');

            const result = await resolvedValue;
            expect(result).toEqual(['a', 'c']);
            expect(host.poppedMode).toBe(true);
        });

        it('should resolve with empty array when nothing checked', async () => {
            const { request, resolvedValue } =
                createMultiSelectRequest(options);
            host.setActiveInputRequest(request);

            await mode.handleInput('\r');

            const result = await resolvedValue;
            expect(result).toEqual([]);
        });

        it('should not move past start or end', async () => {
            const { request } = createMultiSelectRequest(options);
            host.setActiveInputRequest(request);

            await mode.handleInput('\u001B[A'); // Up at index 0
            expect(request.selectedIndex).toBe(0);

            request.selectedIndex = 2;
            await mode.handleInput('\u001B[B'); // Down at last index
            expect(request.selectedIndex).toBe(2);
        });

        it('should ignore Left/Right arrows', async () => {
            const { request } = createMultiSelectRequest(options);
            host.setActiveInputRequest(request);

            await mode.handleInput('\u001B[D'); // Left
            await mode.handleInput('\u001B[C'); // Right

            expect(request.selectedIndex).toBe(0);
        });
    });

    describe('handleNumberInput', () => {
        it('should append digits to buffer', async () => {
            const { request } = createNumberRequest();
            host.setActiveInputRequest(request);

            await mode.handleInput('4');
            await mode.handleInput('2');

            expect(request.buffer).toBe('42');
            expect(request.cursorPosition).toBe(2);
        });

        it('should remove last digit on Backspace', async () => {
            const { request } = createNumberRequest();
            request.buffer = '42';
            request.cursorPosition = 2;
            host.setActiveInputRequest(request);

            await mode.handleInput('\u007F'); // Backspace

            expect(request.buffer).toBe('4');
            expect(request.cursorPosition).toBe(1);
        });

        it('should resolve with parsed number on Enter', async () => {
            const { request, resolvedValue } = createNumberRequest();
            request.buffer = '42';
            request.cursorPosition = 2;
            host.setActiveInputRequest(request);

            await mode.handleInput('\r');

            const result = await resolvedValue;
            expect(result).toBe(42);
            expect(host.poppedMode).toBe(true);
        });

        it('should resolve with default value on Enter with empty buffer', async () => {
            const { request, resolvedValue } = createNumberRequest({
                default: 10,
            });
            host.setActiveInputRequest(request);

            await mode.handleInput('\r');

            const result = await resolvedValue;
            expect(result).toBe(10);
            expect(host.poppedMode).toBe(true);
        });

        it('should show error and stay active for out-of-range number', async () => {
            const { request } = createNumberRequest({ min: 5, max: 100 });
            request.buffer = '3';
            request.cursorPosition = 1;
            host.setActiveInputRequest(request);

            await mode.handleInput('\r');

            // Should NOT have popped mode — still active
            expect(host.poppedMode).toBe(false);
            // Buffer should be cleared for re-entry
            expect(request.buffer).toBe('');
            // Error message should have been written
            const written = (host.terminal as any).written.join('');
            expect(written).toContain('at least 5');
        });

        it('should ignore non-digit characters', async () => {
            const { request } = createNumberRequest();
            host.setActiveInputRequest(request);

            await mode.handleInput('a');
            await mode.handleInput('!');
            await mode.handleInput('\u001B[A'); // Up arrow

            expect(request.buffer).toBe('');
        });

        it('should allow minus sign at start only', async () => {
            const { request } = createNumberRequest();
            host.setActiveInputRequest(request);

            await mode.handleInput('-');
            expect(request.buffer).toBe('-');

            await mode.handleInput('5');
            expect(request.buffer).toBe('-5');

            // Second minus should be ignored
            await mode.handleInput('-');
            expect(request.buffer).toBe('-5');
        });
    });
});

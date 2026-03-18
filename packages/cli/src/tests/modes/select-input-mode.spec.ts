import { CliSelectOption } from '@qodalis/cli-core';
import { InputModeHost } from '../../lib/input/input-mode';
import { SelectInputMode } from '../../lib/input/modes/select-input-mode';

class MockHost implements InputModeHost {
    written: string[] = [];
    modePopped = false;
    terminal = { rows: 24, cols: 80, write: (s: string) => this.written.push(s) } as any;
    filePickerProvider = { isSupported: false, pickFiles: async () => null, pickDirectory: async () => null } as any;
    writeToTerminal(text: string): void { this.written.push(text); }
    getTerminalRows(): number { return this.terminal.rows; }
    getTerminalCols(): number { return this.terminal.cols; }
    pushMode(): void {}
    popMode(): void { this.modePopped = true; }
}

describe('SelectInputMode', () => {
    let host: MockHost;
    let resolved: string | null | undefined;
    let options: CliSelectOption[];

    beforeEach(() => {
        host = new MockHost();
        resolved = undefined;
        options = [
            { label: 'Apple', value: 'apple' },
            { label: 'Banana', value: 'banana' },
            { label: 'Cherry', value: 'cherry' },
        ];
    });

    function createMode(
        opts: CliSelectOption[] = options,
        selectOptions?: any,
    ): SelectInputMode {
        const mode = new SelectInputMode(
            host,
            (v) => { resolved = v; },
            'Pick a fruit',
            opts,
            selectOptions,
        );
        return mode;
    }

    it('should render prompt on activate', () => {
        const mode = createMode();
        mode.activate();
        const output = host.written.join('');
        expect(output).toContain('Pick a fruit');
    });

    it('should move selectedIndex down on down arrow and wrap at end', async () => {
        const mode = createMode();
        mode.activate();
        host.written = [];

        // Down arrow moves to second option
        await mode.handleInput('\x1b[B');
        // Down again to third
        await mode.handleInput('\x1b[B');
        // Down again should wrap to first
        await mode.handleInput('\x1b[B');

        // Press enter — should resolve with 'apple' (wrapped back to first)
        await mode.handleInput('\r');
        expect(resolved).toBe('apple');
    });

    it('should resolve with correct value on Enter', async () => {
        const mode = createMode();
        mode.activate();

        // Default is first option, press enter
        await mode.handleInput('\r');
        expect(resolved).toBe('apple');
        expect(host.modePopped).toBe(true);
    });

    it('should initialize to default selection', () => {
        const mode = createMode(options, { default: 'cherry' });
        mode.activate();

        // Press enter — should resolve with cherry
        mode.handleInput('\r');
        expect(resolved).toBe('cherry');
    });

    it('should skip disabled options during navigation', async () => {
        const opts: CliSelectOption[] = [
            { label: 'Apple', value: 'apple' },
            { label: 'Banana', value: 'banana', disabled: true },
            { label: 'Cherry', value: 'cherry' },
        ];
        const mode = createMode(opts);
        mode.activate();

        // Down from Apple should skip Banana and land on Cherry
        await mode.handleInput('\x1b[B');
        await mode.handleInput('\r');
        expect(resolved).toBe('cherry');
    });

    it('should skip group headers during navigation', async () => {
        const opts: CliSelectOption[] = [
            { label: 'Apple', value: 'apple', group: 'Fruits' },
            { label: 'Carrot', value: 'carrot', group: 'Vegetables' },
        ];
        const mode = createMode(opts);
        mode.activate();

        // Down from Apple should go to Carrot (group headers are not selectable)
        await mode.handleInput('\x1b[B');
        await mode.handleInput('\r');
        expect(resolved).toBe('carrot');
    });

    it('should fire onChange on navigation', async () => {
        const changes: string[] = [];
        const mode = createMode(options, { onChange: (v: string) => changes.push(v) });
        mode.activate();

        await mode.handleInput('\x1b[B'); // Move to banana
        expect(changes).toContain('banana');
    });

    describe('search (when searchable)', () => {
        it('should filter options on printable character input', async () => {
            const mode = createMode(options, { searchable: true });
            mode.activate();
            host.written = [];

            // Type 'ch' to filter to Cherry
            await mode.handleInput('c');
            await mode.handleInput('h');

            // Press enter — should resolve with cherry (only match)
            await mode.handleInput('\r');
            expect(resolved).toBe('cherry');
        });

        it('should clear filter on backspace', async () => {
            const mode = createMode(options, { searchable: true });
            mode.activate();

            // Type 'ch'
            await mode.handleInput('c');
            await mode.handleInput('h');

            // Backspace twice to clear filter
            await mode.handleInput('\u007F');
            await mode.handleInput('\u007F');

            // Now all options visible, press enter for first
            await mode.handleInput('\r');
            expect(resolved).toBe('apple');
        });

        it('should clear filter on first Escape, abort on second', () => {
            const mode = createMode(options, { searchable: true });
            mode.activate();

            // Type a character to set filter
            mode.handleInput('a');

            // First Escape clears filter (not abort)
            const event1 = { code: 'Escape', ctrlKey: false, preventDefault: () => {} } as any;
            mode.handleKeyEvent(event1);
            expect(resolved).toBeUndefined(); // Not aborted yet

            // Second Escape aborts
            const event2 = { code: 'Escape', ctrlKey: false, preventDefault: () => {} } as any;
            mode.handleKeyEvent(event2);
            expect(resolved).toBeNull(); // Aborted
        });
    });

    it('should render descriptions', () => {
        const opts: CliSelectOption[] = [
            { label: 'Apple', value: 'apple', description: 'A red fruit' },
        ];
        const mode = createMode(opts);
        mode.activate();

        const output = host.written.join('');
        expect(output).toContain('A red fruit');
    });
});

import { CliMultiSelectOption } from '@qodalis/cli-core';
import { InputModeHost } from '../../lib/input/input-mode';
import { MultiSelectInputMode } from '../../lib/input/modes/multi-select-input-mode';

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

describe('MultiSelectInputMode', () => {
    let host: MockHost;
    let resolved: string[] | null | undefined;
    let options: CliMultiSelectOption[];

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
        opts: CliMultiSelectOption[] = options,
        selectOptions?: any,
    ): MultiSelectInputMode {
        const mode = new MultiSelectInputMode(
            host,
            (v) => { resolved = v; },
            'Pick fruits',
            opts,
            selectOptions,
        );
        return mode;
    }

    it('should render prompt on activate', () => {
        const mode = createMode();
        mode.activate();
        const output = host.written.join('');
        expect(output).toContain('Pick fruits');
    });

    it('should toggle checked state with Space', async () => {
        const mode = createMode();
        mode.activate();

        // Space to check Apple
        await mode.handleInput(' ');
        // Enter to confirm
        await mode.handleInput('\r');
        expect(resolved).toEqual(['apple']);
    });

    it('should resolve with all checked values on Enter', async () => {
        const mode = createMode();
        mode.activate();

        // Check Apple
        await mode.handleInput(' ');
        // Down to Banana
        await mode.handleInput('\x1b[B');
        // Check Banana
        await mode.handleInput(' ');
        // Enter to confirm
        await mode.handleInput('\r');
        expect(resolved).toEqual(['apple', 'banana']);
    });

    it('should select all with "a" key', async () => {
        const mode = createMode();
        mode.activate();

        // Press 'a' to select all
        await mode.handleInput('a');
        // Enter to confirm
        await mode.handleInput('\r');
        expect(resolved).toEqual(['apple', 'banana', 'cherry']);
    });

    it('should deselect all with "a" when all are checked', async () => {
        const mode = createMode();
        mode.activate();

        // Press 'a' to select all
        await mode.handleInput('a');
        // Press 'a' again to deselect all
        await mode.handleInput('a');
        // Enter to confirm
        await mode.handleInput('\r');
        expect(resolved).toEqual([]);
    });

    it('should navigate up and down with arrows', async () => {
        const mode = createMode();
        mode.activate();

        // Down to Banana
        await mode.handleInput('\x1b[B');
        // Down to Cherry
        await mode.handleInput('\x1b[B');
        // Space to check Cherry
        await mode.handleInput(' ');
        // Enter
        await mode.handleInput('\r');
        expect(resolved).toEqual(['cherry']);
    });

    it('should pre-check options from CliMultiSelectOption.checked', async () => {
        const opts: CliMultiSelectOption[] = [
            { label: 'Apple', value: 'apple', checked: true },
            { label: 'Banana', value: 'banana' },
            { label: 'Cherry', value: 'cherry', checked: true },
        ];
        const mode = createMode(opts);
        mode.activate();

        // Enter immediately — should resolve with pre-checked
        await mode.handleInput('\r');
        expect(resolved).toEqual(['apple', 'cherry']);
    });

    it('should not toggle disabled options', async () => {
        const opts: CliMultiSelectOption[] = [
            { label: 'Apple', value: 'apple', disabled: true },
            { label: 'Banana', value: 'banana' },
            { label: 'Cherry', value: 'cherry' },
        ];
        const mode = createMode(opts);
        mode.activate();

        // First selectable is Banana (Apple is disabled, cursor starts on first non-disabled)
        // Space to check Banana
        await mode.handleInput(' ');
        await mode.handleInput('\r');
        expect(resolved).toEqual(['banana']);
    });

    it('should fire onChange on toggle', async () => {
        const changes: string[][] = [];
        const mode = createMode(options, { onChange: (v: string[]) => changes.push([...v]) });
        mode.activate();

        // Space to check Apple
        await mode.handleInput(' ');
        expect(changes.length).toBeGreaterThan(0);
        expect(changes[changes.length - 1]).toEqual(['apple']);
    });

    it('should filter options when searchable', async () => {
        const mode = createMode(options, { searchable: true });
        mode.activate();
        host.written = [];

        // Type 'ch' to filter to Cherry
        await mode.handleInput('c');
        await mode.handleInput('h');

        // Space to check (should be Cherry, the only match)
        await mode.handleInput(' ');
        // Enter to confirm
        await mode.handleInput('\r');
        expect(resolved).toEqual(['cherry']);
    });

    it('should wrap navigation at boundaries', async () => {
        const mode = createMode();
        mode.activate();

        // Up from first should wrap to last (Cherry)
        await mode.handleInput('\x1b[A');
        await mode.handleInput(' ');
        await mode.handleInput('\r');
        expect(resolved).toEqual(['cherry']);
    });

    it('should abort on Escape', () => {
        const mode = createMode();
        mode.activate();

        const event = { code: 'Escape', ctrlKey: false, preventDefault: () => {} } as any;
        mode.handleKeyEvent(event);
        expect(resolved).toBeNull();
    });

    it('should render help bar with selection count', () => {
        const mode = createMode();
        mode.activate();
        const output = host.written.join('');
        expect(output).toContain('selected');
        expect(output).toContain('space to toggle');
    });

    it('should render checked and unchecked indicators', () => {
        const opts: CliMultiSelectOption[] = [
            { label: 'Apple', value: 'apple', checked: true },
            { label: 'Banana', value: 'banana' },
        ];
        const mode = createMode(opts);
        mode.activate();
        const output = host.written.join('');
        // Checked: ◉, Unchecked: ○
        expect(output).toContain('\u25C9'); // ◉
        expect(output).toContain('\u25CB'); // ○
    });

    it('"a" key should not toggle disabled options', async () => {
        const opts: CliMultiSelectOption[] = [
            { label: 'Apple', value: 'apple', disabled: true },
            { label: 'Banana', value: 'banana' },
            { label: 'Cherry', value: 'cherry' },
        ];
        const mode = createMode(opts);
        mode.activate();

        // Press 'a' to select all non-disabled
        await mode.handleInput('a');
        await mode.handleInput('\r');
        expect(resolved).toEqual(['banana', 'cherry']);
    });
});

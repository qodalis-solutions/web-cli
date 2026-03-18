import { CliSelectOption } from '@qodalis/cli-core';
import { InputModeHost } from '../../lib/input/input-mode';
import { InlineSelectInputMode } from '../../lib/input/modes/inline-select-input-mode';

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

describe('InlineSelectInputMode', () => {
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
    ): InlineSelectInputMode {
        const mode = new InlineSelectInputMode(
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

    it('should navigate right and wrap around', async () => {
        const mode = createMode();
        mode.activate();

        // Right to Banana
        await mode.handleInput('\x1b[C');
        // Right to Cherry
        await mode.handleInput('\x1b[C');
        // Right wraps to Apple
        await mode.handleInput('\x1b[C');

        await mode.handleInput('\r');
        expect(resolved).toBe('apple');
    });

    it('should navigate left and wrap around', async () => {
        const mode = createMode();
        mode.activate();

        // Left wraps to Cherry
        await mode.handleInput('\x1b[D');

        await mode.handleInput('\r');
        expect(resolved).toBe('cherry');
    });

    it('should resolve with correct value on Enter', async () => {
        const mode = createMode();
        mode.activate();

        // Default is first option
        await mode.handleInput('\r');
        expect(resolved).toBe('apple');
        expect(host.modePopped).toBe(true);
    });

    it('should set initial selection from default option', async () => {
        const mode = createMode(options, { default: 'cherry' });
        mode.activate();

        await mode.handleInput('\r');
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

        // Right from Apple should skip Banana and land on Cherry
        await mode.handleInput('\x1b[C');
        await mode.handleInput('\r');
        expect(resolved).toBe('cherry');
    });

    it('should fire onChange callback on navigation', async () => {
        const changes: string[] = [];
        const mode = createMode(options, { onChange: (v: string) => changes.push(v) });
        mode.activate();

        await mode.handleInput('\x1b[C'); // Move to banana
        expect(changes).toContain('banana');
    });

    it('should show overflow indicators when options exceed terminal width', () => {
        // Set very narrow terminal
        host.terminal.cols = 30;
        const opts: CliSelectOption[] = [
            { label: 'Option One', value: '1' },
            { label: 'Option Two', value: '2' },
            { label: 'Option Three', value: '3' },
            { label: 'Option Four', value: '4' },
            { label: 'Option Five', value: '5' },
        ];
        const mode = createMode(opts);
        mode.activate();
        const output = host.written.join('');
        // Should have right overflow indicator since not all options fit
        expect(output).toContain('\u25B8'); // ▸
    });

    it('should scroll visible window to follow selection', async () => {
        // Set very narrow terminal
        host.terminal.cols = 30;
        const opts: CliSelectOption[] = [
            { label: 'Option One', value: '1' },
            { label: 'Option Two', value: '2' },
            { label: 'Option Three', value: '3' },
            { label: 'Option Four', value: '4' },
            { label: 'Option Five', value: '5' },
        ];
        const mode = createMode(opts);
        mode.activate();
        host.written = [];

        // Navigate to the end
        await mode.handleInput('\x1b[C');
        await mode.handleInput('\x1b[C');
        await mode.handleInput('\x1b[C');
        await mode.handleInput('\x1b[C');

        const output = host.written.join('');
        // Should have left overflow indicator since we scrolled right
        expect(output).toContain('\u25C2'); // ◂
    });

    it('should abort on Escape', () => {
        const mode = createMode();
        mode.activate();

        const event = { code: 'Escape', ctrlKey: false, preventDefault: () => {} } as any;
        mode.handleKeyEvent(event);
        expect(resolved).toBeNull();
    });

    it('should abort on Ctrl+C', () => {
        const mode = createMode();
        mode.activate();

        const event = { code: 'KeyC', ctrlKey: true, preventDefault: () => {} } as any;
        mode.handleKeyEvent(event);
        expect(resolved).toBeNull();
    });

    it('should recalculate on resize', async () => {
        host.terminal.cols = 30;
        const opts: CliSelectOption[] = [
            { label: 'Option One', value: '1' },
            { label: 'Option Two', value: '2' },
            { label: 'Option Three', value: '3' },
            { label: 'Option Four', value: '4' },
        ];
        const mode = createMode(opts);
        mode.activate();
        host.written = [];

        // Resize to wider — should re-render
        mode.onResize(120, 24);
        const output = host.written.join('');
        expect(output.length).toBeGreaterThan(0);
    });
});

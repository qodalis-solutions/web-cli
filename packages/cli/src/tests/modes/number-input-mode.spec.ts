import { InputModeHost } from '../../lib/input/input-mode';
import { NumberInputMode } from '../../lib/input/modes/number-input-mode';

class MockHost implements InputModeHost {
    written: string[] = [];
    modePushed = false;
    modePopped = false;
    terminal = { rows: 24, cols: 80, write: (s: string) => this.written.push(s) } as any;
    filePickerProvider = { isSupported: false, pickFiles: async () => null, pickDirectory: async () => null } as any;

    writeToTerminal(text: string): void { this.written.push(text); }
    getTerminalRows(): number { return 24; }
    getTerminalCols(): number { return 80; }
    pushMode(): void { this.modePushed = true; }
    popMode(): void { this.modePopped = true; }
}

describe('NumberInputMode', () => {
    let host: MockHost;
    let resolved: number | null | undefined;

    function makeMode(promptText: string, options?: any): NumberInputMode {
        resolved = undefined;
        return new NumberInputMode(host as any, (val) => { resolved = val; }, promptText, options);
    }

    beforeEach(() => {
        host = new MockHost();
    });

    it('should show prompt on activate', () => {
        const mode = makeMode('Enter number');
        mode.activate();
        expect(host.written.some(s => s.includes('Enter number'))).toBe(true);
        expect(host.written.some(s => s.includes('\x1b[36m?\x1b[0m'))).toBe(true);
    });

    it('should show bounds hint when min and max are provided', () => {
        const mode = makeMode('Age', { min: 0, max: 120 });
        mode.activate();
        const allWritten = host.written.join('');
        expect(allWritten).toContain('0');
        expect(allWritten).toContain('120');
    });

    it('should show min hint when only min is provided', () => {
        const mode = makeMode('Count', { min: 1 });
        mode.activate();
        expect(host.written.join('')).toContain('min: 1');
    });

    it('should show max hint when only max is provided', () => {
        const mode = makeMode('Count', { max: 100 });
        mode.activate();
        expect(host.written.join('')).toContain('max: 100');
    });

    it('should resolve with entered integer on Enter', async () => {
        const mode = makeMode('Number');
        mode.activate();
        await mode.handleInput('4');
        await mode.handleInput('2');
        await mode.handleInput('\r');
        expect(resolved).toBe(42);
        expect(host.modePopped).toBe(true);
    });

    it('should only accept digit characters', async () => {
        const mode = makeMode('Number');
        mode.activate();
        await mode.handleInput('a');
        await mode.handleInput('5');
        await mode.handleInput('!');
        await mode.handleInput('\r');
        expect(resolved).toBe(5);
    });

    it('should allow minus sign at position 0', async () => {
        const mode = makeMode('Number');
        mode.activate();
        await mode.handleInput('-');
        await mode.handleInput('7');
        await mode.handleInput('\r');
        expect(resolved).toBe(-7);
    });

    it('should not allow minus sign at non-zero position', async () => {
        const mode = makeMode('Number');
        mode.activate();
        await mode.handleInput('5');
        await mode.handleInput('-'); // should be ignored
        await mode.handleInput('\r');
        expect(resolved).toBe(5);
    });

    it('should not allow a second minus sign', async () => {
        const mode = makeMode('Number');
        mode.activate();
        await mode.handleInput('-');
        await mode.handleInput('3');
        // Move cursor to position 0 and try another minus
        await mode.handleInput('\u001B[D');
        await mode.handleInput('\u001B[D');
        await mode.handleInput('-'); // already starts with '-', should be ignored
        await mode.handleInput('\r');
        expect(resolved).toBe(-3);
    });

    it('should support backspace', async () => {
        const mode = makeMode('Number');
        mode.activate();
        await mode.handleInput('1');
        await mode.handleInput('2');
        await mode.handleInput('3');
        await mode.handleInput('\u007F'); // delete '3'
        await mode.handleInput('\r');
        expect(resolved).toBe(12);
    });

    it('should support left/right cursor navigation', async () => {
        const mode = makeMode('Number');
        mode.activate();
        await mode.handleInput('1');
        await mode.handleInput('3');
        await mode.handleInput('\u001B[D'); // move left before '3'
        await mode.handleInput('2');
        await mode.handleInput('\r');
        expect(resolved).toBe(123);
    });

    it('should not move cursor left past start', async () => {
        const mode = makeMode('Number');
        mode.activate();
        await mode.handleInput('5');
        await mode.handleInput('\u001B[D');
        await mode.handleInput('\u001B[D'); // clamped at 0
        await mode.handleInput('\r');
        expect(resolved).toBe(5);
    });

    it('should not move cursor right past end', async () => {
        const mode = makeMode('Number');
        mode.activate();
        await mode.handleInput('5');
        await mode.handleInput('\u001B[C'); // already at end
        await mode.handleInput('\r');
        expect(resolved).toBe(5);
    });

    it('should validate minimum value', async () => {
        const mode = makeMode('Number', { min: 10 });
        mode.activate();
        await mode.handleInput('5');
        await mode.handleInput('\r');
        expect(resolved).toBeUndefined();
        expect(host.written.some(s => s.includes('at least 10'))).toBe(true);
    });

    it('should validate maximum value', async () => {
        const mode = makeMode('Number', { max: 10 });
        mode.activate();
        await mode.handleInput('2');
        await mode.handleInput('0');
        await mode.handleInput('\r');
        expect(resolved).toBeUndefined();
        expect(host.written.some(s => s.includes('at most 10'))).toBe(true);
    });

    it('should resolve after fixing a validation error', async () => {
        const mode = makeMode('Number', { min: 10, max: 100 });
        mode.activate();
        await mode.handleInput('5');
        await mode.handleInput('\r'); // fails min
        await mode.handleInput('\u007F'); // delete '5'
        await mode.handleInput('1');
        await mode.handleInput('5');
        await mode.handleInput('\r'); // passes
        expect(resolved).toBe(15);
    });

    it('should resolve with default on empty Enter when default is provided', async () => {
        const mode = makeMode('Number', { default: 42 });
        mode.activate();
        await mode.handleInput('\r');
        expect(resolved).toBe(42);
    });

    it('should not resolve on empty Enter when no default', async () => {
        const mode = makeMode('Number');
        mode.activate();
        await mode.handleInput('\r');
        expect(resolved).toBeUndefined();
    });

    it('should abort on Ctrl+C', () => {
        const mode = makeMode('Number');
        mode.activate();
        const event = new KeyboardEvent('keydown', { code: 'KeyC', ctrlKey: true });
        mode.handleKeyEvent(event);
        expect(resolved).toBeNull();
        expect(host.modePopped).toBe(true);
    });

    it('should ignore unknown escape sequences', async () => {
        const mode = makeMode('Number');
        mode.activate();
        await mode.handleInput('7');
        await mode.handleInput('\u001B[H'); // Home — unknown, should be ignored
        await mode.handleInput('\r');
        expect(resolved).toBe(7);
    });

    it('should pre-fill default value in buffer', () => {
        const mode = makeMode('Number', { default: 99 });
        mode.activate();
        expect(host.written.some(s => s.includes('99'))).toBe(true);
    });
});

import { InputModeHost } from '../../lib/input/input-mode';
import { LineInputMode } from '../../lib/input/modes/line-input-mode';

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

describe('LineInputMode', () => {
    let host: MockHost;
    let resolved: string | null | undefined;

    function makeMode(promptText: string, options?: any): LineInputMode {
        resolved = undefined;
        return new LineInputMode(host as any, (val) => { resolved = val; }, promptText, options);
    }

    beforeEach(() => {
        host = new MockHost();
    });

    it('should show prompt on activate', () => {
        const mode = makeMode('Enter text');
        mode.activate();
        expect(host.written.some(s => s.includes('Enter text'))).toBe(true);
        expect(host.written.some(s => s.includes('\x1b[36m?\x1b[0m'))).toBe(true);
    });

    it('should resolve with entered text on Enter', async () => {
        const mode = makeMode('Name');
        mode.activate();
        await mode.handleInput('h');
        await mode.handleInput('i');
        await mode.handleInput('\r');
        expect(resolved).toBe('hi');
        expect(host.modePopped).toBe(true);
    });

    it('should resolve with empty string on Enter with no input', async () => {
        const mode = makeMode('Name');
        mode.activate();
        await mode.handleInput('\r');
        expect(resolved).toBe('');
    });

    it('should support default value pre-fill', () => {
        const mode = makeMode('Name', { default: 'alice' });
        mode.activate();
        expect(host.written.some(s => s.includes('alice'))).toBe(true);
    });

    it('should resolve with default value on Enter without changes', async () => {
        const mode = makeMode('Name', { default: 'alice' });
        mode.activate();
        await mode.handleInput('\r');
        expect(resolved).toBe('alice');
    });

    it('should show placeholder when buffer is empty', () => {
        const mode = makeMode('Name', { placeholder: 'e.g. Alice' });
        mode.activate();
        expect(host.written.some(s => s.includes('e.g. Alice'))).toBe(true);
    });

    it('should handle backspace correctly', async () => {
        const mode = makeMode('Name');
        mode.activate();
        await mode.handleInput('h');
        await mode.handleInput('i');
        await mode.handleInput('\u007F');
        await mode.handleInput('\r');
        expect(resolved).toBe('h');
    });

    it('should handle backspace mid-string with cursor navigation', async () => {
        const mode = makeMode('Name');
        mode.activate();
        await mode.handleInput('a');
        await mode.handleInput('b');
        await mode.handleInput('c');
        // Move left twice
        await mode.handleInput('\u001B[D');
        await mode.handleInput('\u001B[D');
        // Delete 'a' (cursor is now between nothing and 'a')
        await mode.handleInput('\u007F');
        await mode.handleInput('\r');
        expect(resolved).toBe('bc');
    });

    it('should not move cursor left past start', async () => {
        const mode = makeMode('Name');
        mode.activate();
        await mode.handleInput('a');
        await mode.handleInput('\u001B[D');
        await mode.handleInput('\u001B[D'); // should be clamped
        await mode.handleInput('\r');
        expect(resolved).toBe('a');
    });

    it('should not move cursor right past end', async () => {
        const mode = makeMode('Name');
        mode.activate();
        await mode.handleInput('a');
        await mode.handleInput('\u001B[C'); // already at end
        await mode.handleInput('\r');
        expect(resolved).toBe('a');
    });

    it('should insert text at cursor position', async () => {
        const mode = makeMode('Name');
        mode.activate();
        await mode.handleInput('ac');
        await mode.handleInput('\u001B[D'); // move left before 'c'
        await mode.handleInput('b');
        await mode.handleInput('\r');
        expect(resolved).toBe('abc');
    });

    it('should handle multi-char paste', async () => {
        const mode = makeMode('Name');
        mode.activate();
        await mode.handleInput('hello world');
        await mode.handleInput('\r');
        expect(resolved).toBe('hello world');
    });

    it('should reject input on validation failure and not resolve', async () => {
        const mode = makeMode('Name', {
            validate: (v: string) => v.length < 3 ? 'Too short' : null,
        });
        mode.activate();
        await mode.handleInput('hi');
        await mode.handleInput('\r');
        expect(resolved).toBeUndefined();
        expect(host.written.some(s => s.includes('Too short'))).toBe(true);
    });

    it('should resolve after fixing validation error', async () => {
        const mode = makeMode('Name', {
            validate: (v: string) => v.length < 3 ? 'Too short' : null,
        });
        mode.activate();
        await mode.handleInput('hi');
        await mode.handleInput('\r'); // fails validation
        await mode.handleInput('!');  // now 'hi!'
        await mode.handleInput('\r'); // passes
        expect(resolved).toBe('hi!');
    });

    it('should abort on Ctrl+C', () => {
        const mode = makeMode('Name');
        mode.activate();
        const event = new KeyboardEvent('keydown', { code: 'KeyC', ctrlKey: true });
        mode.handleKeyEvent(event);
        expect(resolved).toBeNull();
        expect(host.modePopped).toBe(true);
    });

    it('should ignore unknown escape sequences', async () => {
        const mode = makeMode('Name');
        mode.activate();
        await mode.handleInput('a');
        await mode.handleInput('\u001B[H'); // Home key — unknown, should be ignored
        await mode.handleInput('\r');
        expect(resolved).toBe('a');
    });
});

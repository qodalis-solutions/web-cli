import { InputModeHost } from '../../lib/input/input-mode';
import { ConfirmInputMode } from '../../lib/input/modes/confirm-input-mode';

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

describe('ConfirmInputMode', () => {
    let host: MockHost;
    let resolved: boolean | null | undefined;

    function makeMode(promptText: string, defaultValue?: boolean): ConfirmInputMode {
        resolved = undefined;
        return new ConfirmInputMode(host as any, (val) => { resolved = val; }, promptText, defaultValue);
    }

    beforeEach(() => {
        host = new MockHost();
    });

    it('should show prompt with (Y/n) hint when default is true', () => {
        const mode = makeMode('Continue?', true);
        mode.activate();
        const allWritten = host.written.join('');
        expect(allWritten).toContain('Continue?');
        expect(allWritten).toContain('(Y/n)');
    });

    it('should show prompt with (y/N) hint when default is false', () => {
        const mode = makeMode('Delete?', false);
        mode.activate();
        const allWritten = host.written.join('');
        expect(allWritten).toContain('Delete?');
        expect(allWritten).toContain('(y/N)');
    });

    it('should default to false when no defaultValue given', () => {
        const mode = makeMode('Continue?');
        mode.activate();
        expect(host.written.join('')).toContain('(y/N)');
    });

    it('should resolve true when y is entered and Enter pressed', async () => {
        const mode = makeMode('Continue?', true);
        mode.activate();
        await mode.handleInput('y');
        await mode.handleInput('\r');
        expect(resolved).toBe(true);
        expect(host.modePopped).toBe(true);
    });

    it('should resolve false when n is entered and Enter pressed', async () => {
        const mode = makeMode('Continue?', true);
        mode.activate();
        await mode.handleInput('n');
        await mode.handleInput('\r');
        expect(resolved).toBe(false);
        expect(host.modePopped).toBe(true);
    });

    it('should be case-insensitive: Y resolves true', async () => {
        const mode = makeMode('Continue?', true);
        mode.activate();
        await mode.handleInput('Y');
        await mode.handleInput('\r');
        expect(resolved).toBe(true);
    });

    it('should be case-insensitive: N resolves false', async () => {
        const mode = makeMode('Continue?', true);
        mode.activate();
        await mode.handleInput('N');
        await mode.handleInput('\r');
        expect(resolved).toBe(false);
    });

    it('should resolve with defaultValue=true on empty Enter', async () => {
        const mode = makeMode('Continue?', true);
        mode.activate();
        await mode.handleInput('\r');
        expect(resolved).toBe(true);
    });

    it('should resolve with defaultValue=false on empty Enter', async () => {
        const mode = makeMode('Delete?', false);
        mode.activate();
        await mode.handleInput('\r');
        expect(resolved).toBe(false);
    });

    it('should ignore non-y/n characters', async () => {
        const mode = makeMode('Continue?', true);
        mode.activate();
        await mode.handleInput('x');
        await mode.handleInput('z');
        await mode.handleInput('5');
        // Buffer should still be empty, so Enter uses default
        await mode.handleInput('\r');
        expect(resolved).toBe(true);
    });

    it('should handle backspace to clear buffer', async () => {
        const mode = makeMode('Continue?', true);
        mode.activate();
        await mode.handleInput('n');
        await mode.handleInput('\u007F'); // backspace
        await mode.handleInput('\r');
        // Buffer should now be empty, resolves with default (true)
        expect(resolved).toBe(true);
    });

    it('should abort on Ctrl+C', () => {
        const mode = makeMode('Continue?');
        mode.activate();
        const event = new KeyboardEvent('keydown', { code: 'KeyC', ctrlKey: true });
        mode.handleKeyEvent(event);
        expect(resolved).toBeNull();
        expect(host.modePopped).toBe(true);
    });

    it('should ignore escape sequences', async () => {
        const mode = makeMode('Continue?', false);
        mode.activate();
        await mode.handleInput('\u001B[D');
        await mode.handleInput('\r');
        expect(resolved).toBe(false); // default used
    });
});

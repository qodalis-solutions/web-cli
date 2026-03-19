import { InputModeHost } from '../../lib/input/input-mode';
import { PasswordInputMode } from '../../lib/input/modes/password-input-mode';

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

describe('PasswordInputMode', () => {
    let host: MockHost;
    let resolved: string | null | undefined;

    function makeMode(promptText: string): PasswordInputMode {
        resolved = undefined;
        return new PasswordInputMode(host as any, (val) => { resolved = val; }, promptText);
    }

    beforeEach(() => {
        host = new MockHost();
    });

    it('should show prompt on activate', () => {
        const mode = makeMode('Password');
        mode.activate();
        expect(host.written.some(s => s.includes('Password'))).toBe(true);
        expect(host.written.some(s => s.includes('\x1b[36m?\x1b[0m'))).toBe(true);
    });

    it('should resolve with entered password on Enter', async () => {
        const mode = makeMode('Password');
        mode.activate();
        await mode.handleInput('s');
        await mode.handleInput('e');
        await mode.handleInput('c');
        await mode.handleInput('\r');
        expect(resolved).toBe('sec');
        expect(host.modePopped).toBe(true);
    });

    it('should display masked characters (asterisks) not raw text', async () => {
        const mode = makeMode('Password');
        mode.activate();
        await mode.handleInput('abc');
        // Check that raw 'abc' is not visible in terminal output
        const allWritten = host.written.join('');
        expect(allWritten).not.toContain('abc');
        // But asterisks should be present after typing
        expect(host.written.some(s => s.includes('***'))).toBe(true);
    });

    it('should handle backspace — remove last character', async () => {
        const mode = makeMode('Password');
        mode.activate();
        await mode.handleInput('abc');
        await mode.handleInput('\u007F');
        await mode.handleInput('\r');
        expect(resolved).toBe('ab');
    });

    it('should not go below empty on backspace', async () => {
        const mode = makeMode('Password');
        mode.activate();
        await mode.handleInput('\u007F'); // nothing to delete
        await mode.handleInput('\r');
        expect(resolved).toBe('');
    });

    it('should ignore left arrow key', async () => {
        const mode = makeMode('Password');
        mode.activate();
        await mode.handleInput('abc');
        await mode.handleInput('\u001B[D'); // left arrow — should be ignored
        await mode.handleInput('\r');
        expect(resolved).toBe('abc');
    });

    it('should ignore right arrow key', async () => {
        const mode = makeMode('Password');
        mode.activate();
        await mode.handleInput('abc');
        await mode.handleInput('\u001B[C'); // right arrow — should be ignored
        await mode.handleInput('\r');
        expect(resolved).toBe('abc');
    });

    it('should ignore all other escape sequences', async () => {
        const mode = makeMode('Password');
        mode.activate();
        await mode.handleInput('pass');
        await mode.handleInput('\u001B[H'); // Home — ignored
        await mode.handleInput('\r');
        expect(resolved).toBe('pass');
    });

    it('should resolve empty string on Enter with no input', async () => {
        const mode = makeMode('Password');
        mode.activate();
        await mode.handleInput('\r');
        expect(resolved).toBe('');
    });

    it('should abort on Ctrl+C', () => {
        const mode = makeMode('Password');
        mode.activate();
        const event = new KeyboardEvent('keydown', { code: 'KeyC', ctrlKey: true });
        mode.handleKeyEvent(event);
        expect(resolved).toBeNull();
        expect(host.modePopped).toBe(true);
    });

    it('should show correct mask length as more chars are typed', async () => {
        const mode = makeMode('Password');
        mode.activate();
        await mode.handleInput('x');
        const allOutput = host.written.join('');
        const after1 = allOutput.includes('*');
        await mode.handleInput('y');
        await mode.handleInput('z');
        const allOutput3 = host.written.join('');
        const after3 = allOutput3.includes('***');
        expect(after1).toBe(true);
        expect(after3).toBe(true);
    });
});

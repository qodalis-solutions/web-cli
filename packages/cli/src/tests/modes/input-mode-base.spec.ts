import { InputModeBase } from '../../lib/input/modes/input-mode-base';
import { InputModeHost } from '../../lib/input/input-mode';

class MockHost implements InputModeHost {
    written: string[] = [];
    modePushed = false;
    modePopped = false;
    terminal = { rows: 24, cols: 80, write: (s: string) => this.written.push(s), writeln: (s: string) => this.written.push(s + '\n') } as any;
    filePickerProvider = { isSupported: false, pickFiles: async () => null, pickDirectory: async () => null };

    writeToTerminal(text: string): void { this.written.push(text); }
    getTerminalRows(): number { return 24; }
    getTerminalCols(): number { return 80; }
    pushMode(): void { this.modePushed = true; }
    popMode(): void { this.modePopped = true; }
}

class ConcreteMode extends InputModeBase<string> {
    async handleInput(_data: string): Promise<void> {}
}

describe('InputModeBase', () => {
    let host: MockHost;
    let mode: ConcreteMode;
    let resolved: string | null | undefined;

    beforeEach(() => {
        host = new MockHost();
        resolved = undefined;
        mode = new ConcreteMode(host as any, (val) => { resolved = val; });
    });

    it('should abort on Ctrl+C', () => {
        const event = new KeyboardEvent('keydown', { code: 'KeyC', ctrlKey: true });
        mode.handleKeyEvent(event);
        expect(resolved).toBeNull();
        expect(host.modePopped).toBe(true);
    });

    it('should abort on Escape', () => {
        const event = new KeyboardEvent('keydown', { code: 'Escape' });
        mode.handleKeyEvent(event);
        expect(resolved).toBeNull();
        expect(host.modePopped).toBe(true);
    });

    it('should resolve and pop on resolveAndPop', () => {
        mode.resolveAndPop('hello');
        expect(resolved).toBe('hello');
        expect(host.modePopped).toBe(true);
    });

    it('should redraw line correctly', () => {
        mode.redrawLine('Prompt: ', 'text', 4);
        expect(host.written.some(s => s.includes('Prompt: '))).toBe(true);
        expect(host.written.some(s => s.includes('text'))).toBe(true);
    });

    it('should write help text as dim', () => {
        mode.writeHelp('↑/↓ navigate');
        expect(host.written.some(s => s.includes('↑/↓ navigate'))).toBe(true);
        expect(host.written.some(s => s.includes('\x1b[2m'))).toBe(true);
    });

    it('should not double-resolve', () => {
        mode.resolveAndPop('first');
        mode.resolveAndPop('second');
        expect(resolved).toBe('first');
    });

    it('should not double-abort', () => {
        const event = new KeyboardEvent('keydown', { code: 'Escape' });
        mode.handleKeyEvent(event);
        expect(resolved).toBeNull();
        // Reset tracking
        host.modePopped = false;
        resolved = 'reset';
        mode.handleKeyEvent(event);
        // Should NOT have changed
        expect(resolved).toBe('reset');
        expect(host.modePopped).toBe(false);
    });
});

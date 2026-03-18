import { InputModeHost } from '../../lib/input/input-mode';
import { DateInputMode } from '../../lib/input/modes/date-input-mode';

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

describe('DateInputMode', () => {
    let host: MockHost;
    let resolved: string | null | undefined;

    function makeMode(promptText: string, options?: any): DateInputMode {
        resolved = undefined;
        return new DateInputMode(host as any, (val) => { resolved = val; }, promptText, options);
    }

    beforeEach(() => {
        host = new MockHost();
    });

    it('should show prompt with format hint on activate', () => {
        const mode = makeMode('Start date');
        mode.activate();
        const allWritten = host.written.join('');
        expect(allWritten).toContain('Start date');
        expect(allWritten).toContain('YYYY-MM-DD');
        expect(allWritten).toContain('\x1b[36m?\x1b[0m');
    });

    it('should accept a valid YYYY-MM-DD date', async () => {
        const mode = makeMode('Date');
        mode.activate();
        for (const ch of '2024-03-15') {
            await mode.handleInput(ch);
        }
        await mode.handleInput('\r');
        expect(resolved).toBe('2024-03-15');
        expect(host.modePopped).toBe(true);
    });

    it('should reject invalid date Feb 30', async () => {
        const mode = makeMode('Date');
        mode.activate();
        for (const ch of '2024-02-30') {
            await mode.handleInput(ch);
        }
        await mode.handleInput('\r');
        expect(resolved).toBeUndefined();
        expect(host.written.some(s => s.includes('✘'))).toBe(true);
    });

    it('should accept Feb 29 on a leap year', async () => {
        const mode = makeMode('Date');
        mode.activate();
        for (const ch of '2024-02-29') {
            await mode.handleInput(ch);
        }
        await mode.handleInput('\r');
        expect(resolved).toBe('2024-02-29');
    });

    it('should reject Feb 29 on a non-leap year', async () => {
        const mode = makeMode('Date');
        mode.activate();
        for (const ch of '2023-02-29') {
            await mode.handleInput(ch);
        }
        await mode.handleInput('\r');
        expect(resolved).toBeUndefined();
        expect(host.written.some(s => s.includes('✘'))).toBe(true);
    });

    it('should accept custom format MM/DD/YYYY', async () => {
        const mode = makeMode('Date', { format: 'MM/DD/YYYY' });
        mode.activate();
        for (const ch of '03/15/2024') {
            await mode.handleInput(ch);
        }
        await mode.handleInput('\r');
        expect(resolved).toBe('03/15/2024');
    });

    it('should reject date below min', async () => {
        const mode = makeMode('Date', { min: '2024-01-01' });
        mode.activate();
        for (const ch of '2023-12-31') {
            await mode.handleInput(ch);
        }
        await mode.handleInput('\r');
        expect(resolved).toBeUndefined();
        expect(host.written.some(s => s.includes('✘'))).toBe(true);
    });

    it('should reject date above max', async () => {
        const mode = makeMode('Date', { max: '2024-12-31' });
        mode.activate();
        for (const ch of '2025-01-01') {
            await mode.handleInput(ch);
        }
        await mode.handleInput('\r');
        expect(resolved).toBeUndefined();
        expect(host.written.some(s => s.includes('✘'))).toBe(true);
    });

    it('should accept date within min/max range', async () => {
        const mode = makeMode('Date', { min: '2024-01-01', max: '2024-12-31' });
        mode.activate();
        for (const ch of '2024-06-15') {
            await mode.handleInput(ch);
        }
        await mode.handleInput('\r');
        expect(resolved).toBe('2024-06-15');
    });

    it('should pre-fill default value', () => {
        const mode = makeMode('Date', { default: '2024-01-01' });
        mode.activate();
        expect(host.written.some(s => s.includes('2024-01-01'))).toBe(true);
    });

    it('should only accept digits and separator character', async () => {
        const mode = makeMode('Date');
        mode.activate();
        await mode.handleInput('a'); // ignored
        await mode.handleInput('2');
        await mode.handleInput('0');
        await mode.handleInput('2');
        await mode.handleInput('4');
        await mode.handleInput('-');
        await mode.handleInput('0');
        await mode.handleInput('3');
        await mode.handleInput('-');
        await mode.handleInput('1');
        await mode.handleInput('5');
        await mode.handleInput('\r');
        expect(resolved).toBe('2024-03-15');
    });

    it('should reject invalid month (13)', async () => {
        const mode = makeMode('Date');
        mode.activate();
        for (const ch of '2024-13-01') {
            await mode.handleInput(ch);
        }
        await mode.handleInput('\r');
        expect(resolved).toBeUndefined();
        expect(host.written.some(s => s.includes('✘'))).toBe(true);
    });

    it('should support backspace', async () => {
        const mode = makeMode('Date');
        mode.activate();
        await mode.handleInput('2');
        await mode.handleInput('0');
        await mode.handleInput('2');
        await mode.handleInput('5');
        await mode.handleInput('\u007F'); // delete '5'
        await mode.handleInput('4');
        await mode.handleInput('-');
        await mode.handleInput('0');
        await mode.handleInput('3');
        await mode.handleInput('-');
        await mode.handleInput('1');
        await mode.handleInput('5');
        await mode.handleInput('\r');
        expect(resolved).toBe('2024-03-15');
    });

    it('should abort on Ctrl+C', () => {
        const mode = makeMode('Date');
        mode.activate();
        const event = new KeyboardEvent('keydown', { code: 'KeyC', ctrlKey: true });
        mode.handleKeyEvent(event);
        expect(resolved).toBeNull();
        expect(host.modePopped).toBe(true);
    });
});

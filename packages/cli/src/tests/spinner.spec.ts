import { Terminal } from '@xterm/xterm';
import { CliTerminalSpinner } from '../lib/services/progress-bars/cli-terminal-spinner';

describe('CliTerminalSpinner', () => {
    function fakeTerminal() {
        let output = '';
        const terminal = {
            cols: 80,
            write: (data: string) => {
                output += data;
            },
            onResize: () => ({ dispose: () => {} }),
        };
        return { terminal: terminal as unknown as Terminal, raw: () => output };
    }

    it('writes nothing when hidden without having been shown', () => {
        const t = fakeTerminal();
        const spinner = new CliTerminalSpinner(t.terminal);

        spinner.hide();

        expect(t.raw()).toBe('');
        expect(spinner.isRunning).toBeFalse();
    });

    it('clears its line when hidden after being shown', async () => {
        const t = fakeTerminal();
        const spinner = new CliTerminalSpinner(t.terminal);
        spinner.show('Booting');
        await new Promise((r) => setTimeout(r, 100));

        spinner.hide();

        expect(t.raw()).toContain('Booting');
        expect(t.raw().endsWith('\x1b[2K\r')).toBeTrue();
        expect(spinner.isRunning).toBeFalse();
    });
});

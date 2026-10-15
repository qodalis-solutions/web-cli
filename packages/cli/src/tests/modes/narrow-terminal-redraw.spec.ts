import { visibleLength } from '@qodalis/cli-core';
import { InputModeHost } from '../../lib/input/input-mode';
import { MultiSelectInputMode } from '../../lib/input/modes/multi-select-input-mode';
import { SelectInputMode } from '../../lib/input/modes/select-input-mode';

/**
 * Pickers redraw in place by moving the cursor up one row per rendered line. A line wider
 * than the terminal wraps onto two rows, the cursor no longer returns to the prompt, and
 * every arrow key printed the prompt again ("? Groups:" repeated). Every rendered row must
 * therefore fit the terminal width.
 */
class NarrowHost implements InputModeHost {
    written: string[] = [];
    terminal = { rows: 24, cols: 30, write: (s: string) => this.written.push(s) } as any;
    filePickerProvider = {} as any;
    writeToTerminal(text: string): void { this.written.push(text); }
    getTerminalRows(): number { return this.terminal.rows; }
    getTerminalCols(): number { return this.terminal.cols; }
    pushMode(): void {}
    popMode(): void {}
}

/** Rows of output as the user sees them, without cursor-control sequences. */
function rows(output: string): string[] {
    return output
        .replace(/\x1b\[\??[0-9;]*[A-HJKSTfhlsu]/g, '')
        .split('\r\n')
        .map((r) => r.replace(/^.*\r/, ''));
}

const LONG = [
    { label: 'admin', value: 'admin', description: 'System administrators with every permission granted' },
    { label: 'users', value: 'users', description: 'Default group for new accounts created through adduser' },
    { label: 'a-group-with-a-really-long-name-that-cannot-fit', value: 'long' },
];

describe('pickers in a narrow terminal', () => {
    let host: NarrowHost;
    beforeEach(() => (host = new NarrowHost()));

    const expectRowsFit = () => {
        for (const row of rows(host.written.join(''))) {
            expect(visibleLength(row)).withContext(JSON.stringify(row)).toBeLessThan(host.terminal.cols);
        }
    };

    it('multi-select keeps every row within the width while navigating', async () => {
        const mode = new MultiSelectInputMode(host, () => {}, 'Groups', LONG);
        mode.activate();
        for (const key of ['\x1b[B', '\x1b[B', '\x1b[A', ' ', '\x1b[A']) await mode.handleInput(key);
        expectRowsFit();
        // Each redraw moves up exactly the rows it rendered: prompt + 3 options + help bar
        const ups = host.written.filter((s) => /^\x1b\[\d+A$/.test(s));
        expect(ups.every((s) => s === '\x1b[4A')).toBeTrue();
    });

    it('single select keeps every row within the width while navigating', async () => {
        const mode = new SelectInputMode(host, () => {}, 'Group', LONG);
        mode.activate();
        for (const key of ['\x1b[B', '\x1b[A', '\x1b[A']) await mode.handleInput(key);
        expectRowsFit();
    });

    it('keeps short lines unchanged', () => {
        host.terminal.cols = 200;
        const mode = new MultiSelectInputMode(host, () => {}, 'Groups', LONG);
        mode.activate();
        expect(host.written.join('')).toContain('System administrators with every permission granted');
    });
});

import { Terminal } from '@xterm/xterm';
import { CliBootLog } from '../lib/services/cli-boot-log';

/** Minimal terminal: records writes and tracks the cursor row like xterm. */
function fakeTerminal(cols = 80) {
    let output = '';
    let row = 0;
    const terminal = {
        cols,
        writeln: (data: string, callback?: () => void) =>
            terminal.write(data + '\r\n', callback),
        write: (data: string, callback?: () => void) => {
            output += data;
            if (data.includes('\x1b[2J')) row = 0;
            row += (data.match(/\r\n/g) ?? []).length;
            callback?.();
        },
        buffer: {
            active: {
                get baseY() {
                    return 0;
                },
                get cursorY() {
                    return row;
                },
            },
        },
    };
    const plain = () => output.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
    return {
        terminal: terminal as unknown as Terminal,
        plain,
        raw: () => output,
    };
}

describe('CliBootLog', () => {
    it('writes nothing when disabled but still tracks progress', async () => {
        const { terminal, raw } = fakeTerminal();
        const log = new CliBootLog(terminal, false);
        log.addSteps(2);
        log.ok('step');
        log.completeStep();
        expect(log.percent).toBe(50);
        await log.finish('done');
        expect(raw()).toBe('');
        expect(log.isFinished).toBeTrue();
    });

    it('lists steps with a progress bar and percentage', () => {
        const { terminal, plain } = fakeTerminal();
        const log = new CliBootLog(terminal, true);
        log.addSteps(4);
        log.setCurrent('Setting up guid');
        log.ok('Set up guid · 1 command', 3);
        log.completeStep();

        expect(plain()).toContain('✔ Set up guid · 1 command  3 ms');
        expect(plain()).toContain(' 25%  Setting up guid');
        expect(plain()).toContain('━');
    });

    it('marks slow steps and keeps lines on one row', () => {
        const { terminal, raw, plain } = fakeTerminal(30);
        const log = new CliBootLog(terminal, true, { slowStepMs: 100 });
        log.ok('A very long module name that would wrap the terminal', 250);
        expect(raw()).toContain('\x1b[33m✔');
        const line = plain().split('\r\n')[0];
        expect(line.length).toBeLessThanOrEqual(30);
        expect(line).toContain('…');
    });

    it('never shortens warnings and errors', () => {
        const { terminal, plain } = fakeTerminal(30);
        const log = new CliBootLog(terminal, true);
        const message =
            "Could not connect to server 'node' at http://localhost:8047";
        log.warn(message);
        log.error(message);
        expect(plain().split(message).length - 1).toBe(2);
    });

    it('clears the report when done and re-prints warnings and errors', async () => {
        const { terminal, plain, raw: rawOutput } = fakeTerminal();
        const log = new CliBootLog(terminal, true);
        log.addSteps(1);
        log.ok('Set up core');
        log.warn('Server x unreachable');
        log.completeStep();
        await log.finish('Ready');

        const afterClear = rawOutput().split('\x1b[2J').pop()!;
        expect(plain()).toContain('Ready');
        const screen = afterClear.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
        expect(screen).toContain('⚠ Server x unreachable');
        expect(screen).not.toContain('Set up core');
    });

    it('keeps the report when asked', async () => {
        const kept = fakeTerminal();
        const log = new CliBootLog(kept.terminal, true);
        log.ok('Set up core');
        await log.finish('Ready', true);
        expect(kept.raw()).not.toContain('\x1b[2J');
    });

    it('replays output written by others during boot after clearing', async () => {
        const mixed = fakeTerminal();
        const log = new CliBootLog(mixed.terminal, true);
        log.addSteps(2);
        log.ok('Set up core');
        mixed.terminal.write('⚠ users: default password\r\n'); // a plugin warning
        log.ok('Set up users');
        await log.finish('Ready');

        const afterClear = mixed.raw().split('\x1b[2J').pop()!;
        expect(afterClear).toContain('⚠ users: default password');
        expect(afterClear).not.toContain('Set up core');
        // the bar never shared a line with the warning
        expect(mixed.raw()).not.toMatch(/%[^\r\n]*users: default/);
    });

    it('does not draw the bar over a line still being written (prompt)', () => {
        const prompt = fakeTerminal();
        const log = new CliBootLog(prompt.terminal, true);
        log.addSteps(2);
        prompt.terminal.write('? Username: ');
        log.completeStep();
        const tail = prompt.raw().split('? Username: ').pop()!;
        expect(tail).not.toContain('━');
    });

    it('clears setup prompts answered during boot but keeps warnings', async () => {
        const t = fakeTerminal();
        const log = new CliBootLog(t.terminal, true);
        log.addSteps(1);
        t.terminal.write('⚠ plugin warning\r\n');
        log.suspend();
        t.terminal.write('? Username: ');
        t.terminal.write('nicolae\r\n? Email: ');
        log.resume();
        log.completeStep();
        await log.finish('Ready');

        const afterClear = t.raw().split('\x1b[2J').pop()!;
        expect(afterClear).toContain('⚠ plugin warning');
        expect(afterClear).not.toContain('Username');
    });

    it('restores the terminal write methods when done', async () => {
        const { terminal } = fakeTerminal();
        const original = terminal.write;
        const log = new CliBootLog(terminal, true);
        log.ok('Set up core');
        expect(terminal.write).not.toBe(original);
        await log.finish('Ready');
        expect(terminal.write).toBe(original);
    });

    it('hides the cursor while the bar shows and restores it', async () => {
        const { terminal, raw } = fakeTerminal();
        const log = new CliBootLog(terminal, true);
        log.addSteps(1);
        expect(raw()).toContain('\x1b[?25l');
        await log.finish('Ready');
        expect(raw().lastIndexOf('\x1b[?25h')).toBeGreaterThan(
            raw().lastIndexOf('\x1b[?25l'),
        );
    });

    it('ignores entries after finish (e.g. later reconnect messages)', async () => {
        const { terminal, plain } = fakeTerminal();
        const log = new CliBootLog(terminal, true);
        await log.finish('Ready', true);
        const before = plain();
        log.ok('Server reconnected');
        log.warn('Server lost');
        expect(plain()).toBe(before);
    });
});

import { Terminal } from '@xterm/xterm';
import { CliTerminalTextAnimator } from '../lib/services/progress-bars/cli-terminal-text-animator';

describe('CliTerminalTextAnimator', () => {
    let written: string;
    let animator: CliTerminalTextAnimator;
    let lineCleared: boolean;

    beforeEach(() => {
        jasmine.clock().install();
        written = '';
        lineCleared = false;
        const terminal = {
            write: (s: string) => (written += s),
        } as unknown as Terminal;
        animator = new CliTerminalTextAnimator(terminal);
        animator.context = {
            currentLine: '',
            setCurrentLine: () => {},
            clearCurrentLine: () => (lineCleared = true),
        } as any;
    });

    afterEach(() => jasmine.clock().uninstall());

    const visible = () => written.replace(/\x1b\[[0-9;]*m/g, '');

    it('cancel erases the typed characters and resolves showText', async () => {
        let resolved = false;
        const done = animator
            .showText('Hello', { speed: 10, removeAfterTyping: true })
            .then(() => (resolved = true));

        jasmine.clock().tick(35); // three characters typed
        expect(visible()).toBe('Hel');

        animator.cancel();
        await done;

        expect(resolved).toBeTrue();
        expect(animator.isRunning).toBeFalse();
        expect(visible()).toBe('Hel' + '\b \b'.repeat(3));
    });

    it('cancel during the pause after typing skips the delayed line clear', async () => {
        const done = animator.showText('Hi', {
            speed: 10,
            removeAfterTyping: true,
        });
        jasmine.clock().tick(35); // typed, now in the 1s pause
        animator.cancel();
        await done;

        jasmine.clock().tick(2000);
        await Promise.resolve();
        expect(lineCleared).toBeFalse();
        expect(visible()).toBe('Hi\b \b\b \b');
    });

    it('cancel is a no-op when nothing runs', () => {
        animator.cancel();
        expect(written).toBe('');
    });

    it('still clears the greeting itself when not cancelled', async () => {
        const done = animator.showText('Hi', {
            speed: 10,
            removeAfterTyping: true,
        });
        jasmine.clock().tick(1100);
        await done;
        expect(lineCleared).toBeTrue();
        expect(animator.isRunning).toBeFalse();
    });
});

import { CliEngine } from '../lib/engine/cli-engine';

/** Whole terminal buffer as text. */
function bufferText(engine: CliEngine): string {
    const buffer = engine.getTerminal().buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < buffer.length; i++) {
        lines.push(buffer.getLine(i)?.translateToString(true) ?? '');
    }
    return lines.join('\n');
}

/** Polls `condition` (xterm writes asynchronously), well within Jasmine's 5 s. */
const until = async (condition: () => boolean, what: string) => {
    const deadline = Date.now() + 3000;
    while (!condition()) {
        if (Date.now() > deadline)
            throw new Error(`Timed out waiting for ${what}`);
        await new Promise((r) => setTimeout(r, 10));
    }
};

describe('CliExecutionContext.interrupt', () => {
    let container: HTMLElement;
    let engine: CliEngine | undefined;

    beforeEach(() => {
        localStorage.clear();
        container = document.createElement('div');
        container.style.width = '800px';
        container.style.height = '400px';
        document.body.appendChild(container);
    });

    afterEach(() => {
        engine?.destroy();
        engine = undefined;
        container.remove();
    });

    it('stops the running command as Ctrl+C does', async () => {
        const cli = (engine = new CliEngine(container, { welcome: false }));
        await cli.start();
        const context = cli.getContext();

        const done = engine.execute('events watch');
        // The command is waiting for Ctrl+C once its first line is on screen
        await until(
            () => bufferText(cli).includes('press Ctrl+C to stop'),
            'events watch to start',
        );
        expect(context.isExecuting).toBeTrue();

        context.interrupt!();
        await done;
        expect(context.isExecuting).toBeFalse();

        // The Ctrl+C line and the prompt land once xterm has flushed them
        await until(
            () =>
                /^Ctrl\+C$/m.test(bufferText(cli)) &&
                /\$$/.test(bufferText(cli).trimEnd()),
            'the Ctrl+C line and the prompt',
        );
        expect(bufferText(cli)).toMatch(/^Ctrl\+C$/m);
        expect(bufferText(cli).trimEnd()).toMatch(/\$$/);
    });
});

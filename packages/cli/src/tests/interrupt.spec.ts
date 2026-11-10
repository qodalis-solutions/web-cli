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

const until = async (condition: () => boolean, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs;
    while (!condition()) {
        if (Date.now() > deadline) throw new Error('timeout');
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
        engine = new CliEngine(container, { welcome: false });
        await engine.start();
        const context = engine.getContext();

        const done = engine.execute('events watch');
        await until(() => context.isExecuting);
        expect(bufferText(engine)).toContain('press Ctrl+C to stop');

        context.interrupt!();
        await done;
        expect(context.isExecuting).toBeFalse();

        // xterm writes asynchronously: the Ctrl+C line and the prompt land next
        await new Promise((r) => setTimeout(r, 50));
        expect(bufferText(engine)).toMatch(/^Ctrl\+C$/m);
        expect(bufferText(engine).trimEnd()).toMatch(/\$$/);
    });
});

import { CliEngine } from '../lib/engine/cli-engine';

/** Whole terminal buffer as text, including scrollback. */
function bufferText(engine: CliEngine): string {
    const buffer = engine.getTerminal().buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < buffer.length; i++) {
        lines.push(buffer.getLine(i)?.translateToString(true) ?? '');
    }
    return lines.join('\n');
}

describe('CliEngine boot', () => {
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

    it('reports boot completion through isBooted and booted', async () => {
        engine = new CliEngine(container);
        expect(engine.isBooted).toBeFalse();
        let resolved = false;
        engine.booted.then(() => (resolved = true));

        await engine.start();
        await Promise.resolve();

        expect(engine.isBooted).toBeTrue();
        expect(resolved).toBeTrue();
        expect(engine.getContext().isBooted).toBeTrue();
    });

    it('clears the boot report and shows the terminal when ready', async () => {
        engine = new CliEngine(container);
        await engine.start();
        await new Promise((r) => setTimeout(r, 50));

        const text = bufferText(engine);
        expect(text).toContain('Welcome to Web CLI');
        expect(text).not.toContain('Starting Web CLI');
    });

    it('starts with just the prompt when the welcome is turned off', async () => {
        engine = new CliEngine(container, { welcome: false });
        await engine.start();
        await new Promise((r) => setTimeout(r, 50));

        const text = bufferText(engine);
        expect(text).not.toContain('Welcome to Web CLI');
        expect(text.trim()).toMatch(/\$$/);
        expect(engine.getContext().isBooted).toBeTrue();
    });

    it('focuses the terminal on start unless autoFocus is off', async () => {
        const input = document.createElement('input');
        document.body.appendChild(input);
        try {
            input.focus();
            engine = new CliEngine(container, { autoFocus: false, welcome: false });
            await engine.start();
            expect(document.activeElement).toBe(input);
            engine.destroy();

            engine = new CliEngine(container, { welcome: false });
            await engine.start();
            expect(container.contains(document.activeElement)).toBeTrue();
        } finally {
            input.remove();
        }
    });

    it('shows a custom welcome message', async () => {
        engine = new CliEngine(container, { welcome: { message: 'Hello from the docs' } });
        await engine.start();
        await new Promise((r) => setTimeout(r, 50));

        const text = bufferText(engine);
        expect(text).toContain('Hello from the docs');
        expect(text).not.toContain('Welcome to Web CLI');
    });

    it('can keep the boot report on screen', async () => {
        engine = new CliEngine(container, { boot: { keepLogs: true } } as any);
        await engine.start();
        await new Promise((r) => setTimeout(r, 50));

        const text = bufferText(engine);
        expect(text).toContain('Starting Web CLI');
        expect(text).toContain('Ready in');
        expect(text).toContain('Welcome to Web CLI');
    });

    it('shows no boot report when disabled', async () => {
        engine = new CliEngine(container, {
            boot: { showLogs: false, keepLogs: true },
        } as any);
        await engine.start();
        await new Promise((r) => setTimeout(r, 50));

        expect(bufferText(engine)).not.toContain('Starting Web CLI');
        expect(engine.isBooted).toBeTrue();
    });

    it('replays keys typed during boot at the first prompt', async () => {
        engine = new CliEngine(container);
        // A module whose setup takes a moment; the user types meanwhile
        engine.registerModule({
            apiVersion: 2,
            name: 'slow-module',
            onInit: async () => {
                const terminal = engine!.getTerminal();
                // One key at a time, like real typing (a single chunk is a paste)
                for (const key of 'echo early\r') {
                    (terminal as any)._core.coreService.triggerDataEvent(
                        key,
                        true,
                    );
                }
                await new Promise((r) => setTimeout(r, 100));
            },
        });

        await engine.start();
        await new Promise((r) => setTimeout(r, 300));

        expect(bufferText(engine)).toContain('$ echo early');
        // replayed after the prompt: the echo output follows it
        expect(bufferText(engine)).toMatch(/\$ echo early\s*\n\s*early/);
    });

    it('a restored snapshot shows exactly the original screen', async () => {
        // A module that writes during every boot (like the users warning)
        const noisy = {
            apiVersion: 2,
            name: 'noisy',
            onInit: async (ctx: any) => ctx.writer.writeWarning('boot warning'),
        };
        engine = new CliEngine(container);
        engine.registerModule(noisy);
        await engine.start();
        await new Promise((r) => setTimeout(r, 50));
        const original = bufferText(engine).trimEnd();
        const snapshot = engine.snapshot();
        engine.destroy();

        engine = new CliEngine(container, { snapshot } as any);
        engine.registerModule(noisy);
        await engine.start();
        await new Promise((r) => setTimeout(r, 50));

        const restored = bufferText(engine).trimEnd();
        expect(restored.split('boot warning').length).toBe(
            original.split('boot warning').length,
        );
        expect(restored).toContain('Welcome to Web CLI');
    });
});

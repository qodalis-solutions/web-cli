import { CliEngine } from '../lib/engine/cli-engine';
import { CliKeyValueStore } from '../lib/storage/cli-key-value-store';

/**
 * Saved state across engines (terminals), with the real IndexedDB store.
 * Each start plays the welcome greeting (about 3 s), hence the timeouts.
 */
describe('State persistence across terminals', () => {
    const engines: CliEngine[] = [];
    const containers: HTMLElement[] = [];

    const startEngine = async (): Promise<CliEngine> => {
        const container = document.createElement('div');
        container.style.width = '800px';
        container.style.height = '400px';
        document.body.appendChild(container);
        containers.push(container);
        const engine = new CliEngine(container, {
            boot: { showLogs: false },
        } as any);
        engines.push(engine);
        await engine.start();
        return engine;
    };

    const screen = async (engine: CliEngine): Promise<string> => {
        await new Promise<void>((r) => engine.getTerminal().write('', r));
        const buffer = engine.getTerminal().buffer.active;
        let text = '';
        for (let i = 0; i < buffer.length; i++) {
            text += buffer.getLine(i)?.translateToString(true) + '\n';
        }
        return text;
    };

    beforeEach(async () => {
        const kv = new CliKeyValueStore();
        await kv.initialize();
        await kv.remove('store-state-snippets');
    });

    afterEach(() => {
        engines.splice(0).forEach((e) => e.destroy());
        containers.splice(0).forEach((c) => c.remove());
    });

    it('keeps snippets saved before a reload when saving another one', async () => {
        const first = await startEngine();
        await first.execute('snippet save one echo first');
        first.destroy();

        // "Reload": a new terminal
        const second = await startEngine();
        await second.execute('snippet save two echo second');
        await second.execute('snippet list');

        const text = await screen(second);
        expect(text).toContain('one');
        expect(text).toContain('two');
    }, 20000);

    it('a terminal sees what another open terminal saved', async () => {
        const a = await startEngine();
        const b = await startEngine();

        await a.execute('snippet save fromA echo a');
        await new Promise((r) => setTimeout(r, 50)); // sync between tabs

        // b had the store loaded before a saved: it got a's change, so its
        // own save keeps it
        await b.execute('snippet save fromB echo b');
        await b.execute('snippet list');
        const text = await screen(b);
        expect(text).toContain('fromA');
        expect(text).toContain('fromB');
    }, 20000);
});

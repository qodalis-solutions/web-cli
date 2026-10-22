import { CliTestHarness } from '../lib/testing';
import { CliHotKeysCommandProcessor } from '../lib/processors/system/cli-hot-keys-command-processor';

describe('hotkeys command', () => {
    it('lists the line editing keys', async () => {
        const h = new CliTestHarness();
        h.registerProcessors([new CliHotKeysCommandProcessor()]);
        const out = (await h.execute('hotkeys')).stdout.join('\n');
        for (const key of ['Ctrl + C', 'Escape', 'Ctrl + A / Home', 'Ctrl + E / End', 'Ctrl + U', 'Ctrl + K', 'Ctrl + W', 'Ctrl + Y', 'Ctrl + D / Del']) {
            expect(out).toContain(key);
        }
    });
});

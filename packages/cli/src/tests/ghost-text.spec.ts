import { CliCompletionEngine } from '../lib/completion/cli-completion-engine';
import { CliCommandCompletionProvider } from '../lib/completion/cli-command-completion-provider';
import { CliCommandProcessorRegistry } from '../lib/registry/cli-command-processor-registry';

describe('CliCompletionEngine.completeSingle', () => {
    let engine: CliCompletionEngine;

    beforeEach(() => {
        const registry = new CliCommandProcessorRegistry();
        registry.registerProcessor({
            command: 'theme',
            description: 'test',
            processCommand: async () => {},
        });
        registry.registerProcessor({
            command: 'time',
            description: 'test',
            processCommand: async () => {},
        });
        engine = new CliCompletionEngine();
        engine.setProviders([new CliCommandCompletionProvider(registry)]);
    });

    it('returns null when input is empty', async () => {
        const result = await engine.completeSingle('', 0);
        expect(result).toBeNull();
    });

    it('returns null when multiple candidates exist', async () => {
        const result = await engine.completeSingle('t', 1);
        expect(result).toBeNull();
    });

    it('returns full command when single match', async () => {
        const result = await engine.completeSingle('them', 4);
        expect(result).toBe('theme');
    });

    it('returns null when no match', async () => {
        const result = await engine.completeSingle('zzz', 3);
        expect(result).toBeNull();
    });
});

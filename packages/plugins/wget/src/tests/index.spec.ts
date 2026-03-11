import { CliWgetCommandCommandProcessor } from '../lib/processors/cli-wget-command-processor';

describe('CliWgetCommandModule', () => {
    it('processor instance should be created', () => {
        const processor = new CliWgetCommandCommandProcessor();
        expect(processor).toBeDefined();
    });

    it('should have correct command name', () => {
        const processor = new CliWgetCommandCommandProcessor();
        expect(processor.command).toBe('wget');
    });
});

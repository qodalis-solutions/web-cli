import { CliMarkdownCommandProcessor } from '../lib/processors/cli-markdown-command-processor';

describe('CliMarkdownCommandProcessor', () => {
    it('processor instance should be created', () => {
        const processor = new CliMarkdownCommandProcessor();
        expect(processor).toBeDefined();
    });

    it('should have correct command name', () => {
        const processor = new CliMarkdownCommandProcessor();
        expect(processor.command).toBe('md');
    });
});

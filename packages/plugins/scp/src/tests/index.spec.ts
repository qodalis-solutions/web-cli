import { CliScpCommandCommandProcessor } from '../lib/processors/cli-scp-command-processor';

describe('CliScpCommandModule', () => {
    it('processor instance should be created', () => {
        const processor = new CliScpCommandCommandProcessor();
        expect(processor).toBeDefined();
    });

    it('should have correct command name', () => {
        const processor = new CliScpCommandCommandProcessor();
        expect(processor.command).toBe('scp');
    });
});

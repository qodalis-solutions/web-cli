import { CliDataExplorerCommandProcessor } from '../lib/processors/cli-data-explorer-command-processor';

describe('CliDataExplorerModule', () => {
    it('processor instance should be created', () => {
        const processor = new CliDataExplorerCommandProcessor();
        expect(processor).toBeDefined();
    });

    it('should have correct command name', () => {
        const processor = new CliDataExplorerCommandProcessor();
        expect(processor.command).toBe('data-explorer');
    });
});

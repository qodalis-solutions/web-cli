import { CliCsvCommandProcessor } from '../lib/processors/cli-csv-command-processor';

describe('CliCsvCommandProcessor', () => {
    it('processor instance should be created', () => {
        const processor = new CliCsvCommandProcessor();
        expect(processor).toBeDefined();
    });

    it('should have correct command name', () => {
        const processor = new CliCsvCommandProcessor();
        expect(processor.command).toBe('csv');
    });
});

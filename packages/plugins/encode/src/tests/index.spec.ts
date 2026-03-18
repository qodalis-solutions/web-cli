import { CliCliEncodeCommandProcessor } from '../lib/processors/cli-encode-command-processor';

describe('CliCliEncodeModule', () => {
    it('processor instance should be created', () => {
        const processor = new CliCliEncodeCommandProcessor();
        expect(processor).toBeDefined();
    });

    it('should have correct command name', () => {
        const processor = new CliCliEncodeCommandProcessor();
        expect(processor.command).toBe('encode');
    });
});

import { CliYesnoCommandProcessor } from '../lib/processors/cli-yesno-command-processor';

describe('CliYesnoModule', () => {
    it('processor instance should be created', () => {
        const processor = new CliYesnoCommandProcessor();

        expect(processor).toBeDefined();
    });

    it('should have correct command name', () => {
        const processor = new CliYesnoCommandProcessor();

        expect(processor.command).toBe('yesno');
    });

    it('should allow unlisted commands for question input', () => {
        const processor = new CliYesnoCommandProcessor();

        expect(processor.acceptsRawInput).toBe(true);
    });
});

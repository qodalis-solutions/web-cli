import { CliCronCommandProcessor } from '../lib/processors/cli-cron-command-processor';

describe('CliCronCommandProcessor', () => {
    it('processor instance should be created', () => {
        const processor = new CliCronCommandProcessor();
        expect(processor).toBeDefined();
    });

    it('should have correct command name', () => {
        const processor = new CliCronCommandProcessor();
        expect(processor.command).toBe('cron');
    });
});

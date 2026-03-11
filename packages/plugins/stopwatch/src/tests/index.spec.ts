import { CliStopwatchCommandProcessor } from '../lib/processors/cli-stopwatch-command-processor';

describe('CliStopwatchCommandProcessor', () => {
    it('processor instance should be created', () => {
        const processor = new CliStopwatchCommandProcessor();
        expect(processor).toBeDefined();
    });

    it('should have correct command name', () => {
        const processor = new CliStopwatchCommandProcessor();
        expect(processor.command).toBe('stopwatch');
    });
});

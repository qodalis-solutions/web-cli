import { CliChartCommandProcessor } from '../lib/processors/cli-chart-command-processor';

describe('CliChartCommandProcessor', () => {
    it('processor instance should be created', () => {
        const processor = new CliChartCommandProcessor();
        expect(processor).toBeDefined();
    });

    it('should have correct command name', () => {
        const processor = new CliChartCommandProcessor();
        expect(processor.command).toBe('chart');
    });

    it('should have sub-processors', () => {
        const processor = new CliChartCommandProcessor();
        expect(processor.processors).toBeDefined();
        expect(processor.processors!.length).toBe(3);
    });

    it('should have bar sub-command', () => {
        const processor = new CliChartCommandProcessor();
        const bar = processor.processors!.find((p) => p.command === 'bar');
        expect(bar).toBeDefined();
    });

    it('should have line sub-command', () => {
        const processor = new CliChartCommandProcessor();
        const line = processor.processors!.find((p) => p.command === 'line');
        expect(line).toBeDefined();
    });

    it('should have sparkline sub-command', () => {
        const processor = new CliChartCommandProcessor();
        const sparkline = processor.processors!.find((p) => p.command === 'sparkline');
        expect(sparkline).toBeDefined();
    });
});

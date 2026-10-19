import { CliTestHarness } from '@qodalis/cli';
import { CliChartCommandProcessor } from '../lib/processors/cli-chart-command-processor';

describe('chart with quoted arguments', () => {
    it('reads data given in quotes without the quotes', async () => {
        const harness = new CliTestHarness();
        harness.registerProcessor(new CliChartCommandProcessor());
        const result = await harness.execute(`chart bar 'cpu:3'`);
        expect(result.stderr).toEqual([]);
        expect(result.output).toContain('cpu');
        expect(result.output).not.toContain("'");
    });
});

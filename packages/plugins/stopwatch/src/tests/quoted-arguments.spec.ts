import { CliTestHarness } from '@qodalis/cli';
import { CliStopwatchCommandProcessor } from '../lib/processors/cli-stopwatch-command-processor';

describe('stopwatch timer with quoted arguments', () => {
    it('reports a quoted duration without its quotes', async () => {
        const harness = new CliTestHarness();
        harness.registerProcessor(new CliStopwatchCommandProcessor());
        const result = await harness.execute('stopwatch timer "abc"');
        expect(result.stderr.join('\n')).toContain('Invalid or too-short duration "abc"');
    });
});

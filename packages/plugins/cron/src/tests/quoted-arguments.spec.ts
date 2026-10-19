import { CliTestHarness } from '@qodalis/cli';
import { CliCronCommandProcessor } from '../lib/processors/cli-cron-command-processor';

describe('cron with quoted arguments', () => {
    it('stores a quoted command without its quotes and removes by quoted name', async () => {
        const harness = new CliTestHarness();
        harness.registerProcessor(new CliCronCommandProcessor());
        let result = await harness.execute('cron add "my job" 10m "echo hi there"');
        expect(result.output).toContain('Job "my job" added');
        expect(result.output).toContain(': echo hi there');

        result = await harness.execute(`cron add raw 10m echo "a b"`);
        expect(result.output).toContain(': echo "a b"');

        result = await harness.execute('cron remove "my job"');
        expect(result.output).toContain('Job "my job" removed');
        await harness.execute('cron remove raw');
    });
});

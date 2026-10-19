import { CliTestHarness } from '@qodalis/cli';
import { CliCsvCommandProcessor } from '../lib/processors/cli-csv-command-processor';

describe('csv with quoted arguments', () => {
    it('reads CSV given in single quotes, keeping its own quoting', async () => {
        const harness = new CliTestHarness();
        harness.registerProcessor(new CliCsvCommandProcessor());
        const result = await harness.execute(`csv columns 'name,"full name",age'`);
        expect(result.stdout).toEqual(['  0: name', '  1: full name', '  2: age']);
    });
});

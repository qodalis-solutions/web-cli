import { CliTestHarness } from '@qodalis/cli';
import { CliRegexCommandProcessor } from '../lib/processors/cli-regex-command-processor';

describe('regex with quoted arguments', () => {
    let harness: CliTestHarness;

    beforeEach(() => {
        harness = new CliTestHarness();
        harness.registerProcessor(new CliRegexCommandProcessor());
    });

    it('tests the text inside the quotes, keeping backslashes of a single-quoted pattern', async () => {
        const result = await harness.execute(`regex test "abc 123" --pattern='^abc \\d+$'`);
        expect(result.output).toContain('Pattern matches');
    });

    it('does not see the quotes as part of the text', async () => {
        const result = await harness.execute(`regex test "abc" --pattern='^abc$'`);
        expect(result.output).toContain('Pattern matches');
    });
});

import { CliTestHarness } from '@qodalis/cli';
import { CliGuidCommandProcessor } from '../lib/processors/cli-guid-command-processor';

describe('guid with quoted arguments', () => {
    const uuid = '6f9619ff-8b86-4d11-b42d-00c04fc964ff';
    let harness: CliTestHarness;

    beforeEach(() => {
        harness = new CliTestHarness();
        harness.registerProcessor(new CliGuidCommandProcessor());
    });

    it('validates a quoted UUID', async () => {
        const result = await harness.execute(`guid validate "${uuid}"`);
        expect(result.output).toContain('Valid UUID');
        expect(result.stderr).toEqual([]);
    });

    it('compares quoted UUIDs', async () => {
        const result = await harness.execute(`guid compare '${uuid}' "${uuid.toUpperCase()}"`);
        expect(result.output).toContain('The UUIDs are equal');
    });
});

import { CliTestHarness } from '@qodalis/cli';
import { CliLocalStorageCommandProcessor } from '../lib/processors/cli-local-storage-command-processor';

describe('local-storage with quoted arguments', () => {
    const key = 'qcli-test-quoted';

    afterEach(() => localStorage.removeItem(key));

    it('stores a quoted value without its quotes, case kept', async () => {
        const harness = new CliTestHarness();
        harness.registerProcessor(new CliLocalStorageCommandProcessor());
        await harness.execute(`local-storage set ${key} "Hello World"`);
        expect(localStorage.getItem(key)).toBe('Hello World');

        const result = await harness.execute(`local-storage get ${key}`);
        expect(result.output).toBe('Hello World');

        await harness.execute(`local-storage remove ${key}`);
        expect(localStorage.getItem(key)).toBeNull();
    });
});

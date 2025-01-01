import { CliSpeedTestCommandProcessor } from '../lib/processors/cli-speed-test-command-processor';

describe('CliSpedTestModule', () => {
    it('processor instance should be created', () => {
        const processor = new CliSpeedTestCommandProcessor();

        expect(processor).toBeDefined();
    });
});

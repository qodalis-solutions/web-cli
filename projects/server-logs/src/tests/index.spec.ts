import { CliLogsCommandProcessor } from '../lib/processors/cli-logs-command-processor';

describe('CliServerLogsNodule', () => {
    it('processor instance should be created', () => {
        const processor = new CliLogsCommandProcessor();

        expect(processor).toBeDefined();
    });
});

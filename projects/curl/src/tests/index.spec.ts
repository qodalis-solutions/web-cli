import { CliCurlCommandProcessor } from '../lib/processors/cli-curl-command-processor';

describe('CliCurlModule', () => {
    it('processor instance should be created', () => {
        const processor = new CliCurlCommandProcessor();

        expect(processor).toBeDefined();
    });
});

import { CliTextToImageCommandProcessor } from '../lib/processors/cli-text-to-image-command-processor';

describe('CliTextToImageModule', () => {
    it('processor instance should be created', () => {
        const processor = new CliTextToImageCommandProcessor();

        expect(processor).toBeDefined();
    });
});

import { CliQrCommandProcessor } from '../lib/processors/cli-qr-command-processor';

describe('CliQrModule', () => {
    it('processor instance should be created', () => {
        const processor = new CliQrCommandProcessor();

        expect(processor).toBeDefined();
    });
});

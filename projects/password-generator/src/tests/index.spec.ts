import { CliPasswordGeneratorCommandProcessor } from '../lib/processors/cli-password-generator-command-processor';

describe('CliPasswordGeneratorModule', () => {
    it('processor instance should be created', () => {
        const processor = new CliPasswordGeneratorCommandProcessor();

        expect(processor).toBeDefined();
    });
});

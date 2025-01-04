import { CliStringCommandProcessor } from '../lib/processors/cli-string-command-processor';

describe('CliStringModule', () => {
    it('processor instance should be created', () => {
        const processor = new CliStringCommandProcessor();

        expect(processor).toBeDefined();
    });
});

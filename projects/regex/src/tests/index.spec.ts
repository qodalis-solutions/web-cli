import { CliRegexCommandProcessor } from '../lib';

describe('CliRegexNodule', () => {
    it('regex processor instance should be created', () => {
        const processor = new CliRegexCommandProcessor();

        expect(processor).toBeDefined();
    });
});

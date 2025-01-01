import {
    CliCookiesCommandProcessor,
    CliLocalStorageCommandProcessor,
} from '../lib';

describe('CliBrowserStorageModule', () => {
    it('cookies processor instance should be created', () => {
        const processor = new CliCookiesCommandProcessor();

        expect(processor).toBeDefined();
    });

    it('local storage processor instance should be created', () => {
        const processor = new CliLocalStorageCommandProcessor();

        expect(processor).toBeDefined();
    });
});

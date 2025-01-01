import { generateGUID, validateGUID } from '../lib/utilities';

describe('CliGuidModule', () => {
    const guid = generateGUID();

    it('guid should have a value', () => {
        expect(guid).not.toBeNull();
    });

    it('guid should have a length of 36 characters', () => {
        expect(guid.length).toBe(36);
    });

    it('guid should have a valid format', () => {
        expect(validateGUID(guid)).toBeTrue();
    });
});

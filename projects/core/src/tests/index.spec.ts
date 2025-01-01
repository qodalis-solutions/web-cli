import { getRightOfWord } from '../lib';

describe('core tests', () => {
    it('getRightOfWord should return the right text', () => {
        // Arrange
        const command = 'regex validate invalid';

        // Act
        const result = getRightOfWord(command, 'validate');

        // Assert
        expect(result).toBe('invalid');
    });
});

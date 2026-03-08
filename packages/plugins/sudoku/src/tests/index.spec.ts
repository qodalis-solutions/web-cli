import { CliSudokuCommandProcessor } from '../lib/processors/cli-sudoku-command-processor';

describe('CliSudokuCommandProcessor', () => {
    it('processor instance should be created', () => {
        const processor = new CliSudokuCommandProcessor();
        expect(processor).toBeDefined();
    });

    it('should have correct command name', () => {
        const processor = new CliSudokuCommandProcessor();
        expect(processor.command).toBe('sudoku');
    });
});

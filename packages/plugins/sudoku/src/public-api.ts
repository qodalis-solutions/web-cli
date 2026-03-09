/*
 * Public API Surface of sudoku
 */

export * from './lib/processors/cli-sudoku-command-processor';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliSudokuCommandProcessor } from './lib/processors/cli-sudoku-command-processor';
import { API_VERSION } from './lib/version';

export const sudokuModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-sudoku',
    processors: [new CliSudokuCommandProcessor()],
    translations: {
        es: { 'cli.sudoku.description': 'Jugar al Sudoku' },
        fr: { 'cli.sudoku.description': 'Jouer au Sudoku' },
        de: { 'cli.sudoku.description': 'Sudoku spielen' },
        pt: { 'cli.sudoku.description': 'Jogar Sudoku' },
        it: { 'cli.sudoku.description': 'Giocare a Sudoku' },
        ja: { 'cli.sudoku.description': '数独をプレイ' },
        ko: { 'cli.sudoku.description': '스도쿠 플레이' },
        zh: { 'cli.sudoku.description': '玩数独游戏' },
        ru: { 'cli.sudoku.description': 'Играть в судоку' },
        ro: { 'cli.sudoku.description': 'Joacă Sudoku' },
    },
};

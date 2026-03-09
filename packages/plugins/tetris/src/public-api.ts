/*
 * Public API Surface of tetris
 */

export * from './lib/processors/cli-tetris-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliTetrisCommandProcessor } from './lib/processors/cli-tetris-command-processor';
import { API_VERSION } from './lib/version';

export const tetrisModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-tetris',
    processors: [new CliTetrisCommandProcessor()],
    translations: {
        es: { 'cli.tetris.description': 'Jugar al Tetris' },
        fr: { 'cli.tetris.description': 'Jouer au Tetris' },
        de: { 'cli.tetris.description': 'Tetris spielen' },
        pt: { 'cli.tetris.description': 'Jogar Tetris' },
        it: { 'cli.tetris.description': 'Giocare a Tetris' },
        ja: { 'cli.tetris.description': 'テトリスをプレイ' },
        ko: { 'cli.tetris.description': '테트리스 플레이' },
        zh: { 'cli.tetris.description': '玩俄罗斯方块' },
        ru: { 'cli.tetris.description': 'Играть в тетрис' },
        ro: { 'cli.tetris.description': 'Joacă Tetris' },
    },
};

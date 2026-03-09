/*
 * Public API Surface of minesweeper
 */

export * from './lib/processors/cli-minesweeper-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliMinesweeperCommandProcessor } from './lib/processors/cli-minesweeper-command-processor';
import { API_VERSION } from './lib/version';

export const minesweeperModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-minesweeper',
    processors: [new CliMinesweeperCommandProcessor()],
    translations: {
        es: { 'cli.minesweeper.description': 'Jugar al buscaminas' },
        fr: { 'cli.minesweeper.description': 'Jouer au démineur' },
        de: { 'cli.minesweeper.description': 'Minesweeper spielen' },
        pt: { 'cli.minesweeper.description': 'Jogar campo minado' },
        it: { 'cli.minesweeper.description': 'Giocare a campo minato' },
        ja: { 'cli.minesweeper.description': 'マインスイーパーをプレイ' },
        ko: { 'cli.minesweeper.description': '지뢰찾기 플레이' },
        zh: { 'cli.minesweeper.description': '玩扫雷游戏' },
        ru: { 'cli.minesweeper.description': 'Играть в сапёра' },
        ro: { 'cli.minesweeper.description': 'Joacă Minesweeper' },
    },
};

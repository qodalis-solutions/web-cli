/*
 * Public API Surface of snake
 */

export * from './lib/processors/cli-snake-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliSnakeCommandProcessor } from './lib/processors/cli-snake-command-processor';
import { API_VERSION } from './lib/version';

export const snakeModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-snake',
    processors: [new CliSnakeCommandProcessor()],
    translations: {
        es: { 'cli.snake.description': 'Jugar a la serpiente' },
        fr: { 'cli.snake.description': 'Jouer au serpent' },
        de: { 'cli.snake.description': 'Snake spielen' },
        pt: { 'cli.snake.description': 'Jogar cobra' },
        it: { 'cli.snake.description': 'Giocare a snake' },
        ja: { 'cli.snake.description': 'スネークゲームをプレイ' },
        ko: { 'cli.snake.description': '스네이크 게임 플레이' },
        zh: { 'cli.snake.description': '玩贪吃蛇游戏' },
        ru: { 'cli.snake.description': 'Играть в змейку' },
        ro: { 'cli.snake.description': 'Joacă Snake' },
    },
};

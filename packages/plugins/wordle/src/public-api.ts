/*
 * Public API Surface of wordle
 */

export * from './lib/processors/cli-wordle-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliWordleCommandProcessor } from './lib/processors/cli-wordle-command-processor';
import { API_VERSION } from './lib/version';

export const wordleModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-wordle',
    processors: [new CliWordleCommandProcessor()],
    translations: {
        es: { 'cli.wordle.description': 'Jugar a adivinar la palabra' },
        fr: { 'cli.wordle.description': 'Jouer au jeu de mots Wordle' },
        de: { 'cli.wordle.description': 'Wordle spielen' },
        pt: { 'cli.wordle.description': 'Jogar Wordle' },
        it: { 'cli.wordle.description': 'Giocare a Wordle' },
        ja: { 'cli.wordle.description': 'ワードルをプレイ' },
        ko: { 'cli.wordle.description': '워들 플레이' },
        zh: { 'cli.wordle.description': '玩猜词游戏' },
        ru: { 'cli.wordle.description': 'Играть в Wordle' },
        ro: { 'cli.wordle.description': 'Joacă Wordle' },
    },
};

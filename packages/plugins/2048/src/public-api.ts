/*
 * Public API Surface of 2048
 */

export * from './lib/processors/cli-2048-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { Cli2048CommandProcessor } from './lib/processors/cli-2048-command-processor';
import { API_VERSION } from './lib/version';

export const game2048Module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-2048',
    processors: [new Cli2048CommandProcessor()],
    translations: {
        es: { 'cli.2048.description': 'Jugar al 2048' },
        fr: { 'cli.2048.description': 'Jouer au 2048' },
        de: { 'cli.2048.description': '2048 spielen' },
        pt: { 'cli.2048.description': 'Jogar 2048' },
        it: { 'cli.2048.description': 'Giocare a 2048' },
        ja: { 'cli.2048.description': '2048をプレイ' },
        ko: { 'cli.2048.description': '2048 게임 플레이' },
        zh: { 'cli.2048.description': '玩2048游戏' },
        ru: { 'cli.2048.description': 'Играть в 2048' },
        ro: { 'cli.2048.description': 'Joacă 2048' },
    },
};

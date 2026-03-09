/*
 * Public API Surface of stopwatch
 */

export * from './lib/processors/cli-stopwatch-command-processor';
export * from './lib/stopwatch-utils';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliStopwatchCommandProcessor } from './lib/processors/cli-stopwatch-command-processor';
import { API_VERSION } from './lib/version';

export const stopwatchModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-stopwatch',
    processors: [new CliStopwatchCommandProcessor()],
    translations: {
        es: { 'cli.stopwatch.description': 'Cronómetro interactivo y temporizador' },
        fr: { 'cli.stopwatch.description': 'Chronomètre interactif et minuteur' },
        de: { 'cli.stopwatch.description': 'Interaktive Stoppuhr und Countdown-Timer' },
        pt: { 'cli.stopwatch.description': 'Cronômetro interativo e temporizador' },
        it: { 'cli.stopwatch.description': 'Cronometro interattivo e timer' },
        ja: { 'cli.stopwatch.description': 'インタラクティブなストップウォッチとタイマー' },
        ko: { 'cli.stopwatch.description': '대화형 스톱워치 및 타이머' },
        zh: { 'cli.stopwatch.description': '交互式秒表和倒计时器' },
        ru: { 'cli.stopwatch.description': 'Интерактивный секундомер и таймер обратного отсчёта' },
        ro: { 'cli.stopwatch.description': 'Cronometru interactiv și numărătoare inversă' },
    },
};

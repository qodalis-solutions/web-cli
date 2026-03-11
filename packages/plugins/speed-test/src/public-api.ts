/*
 * Public API Surface of speed-test
 */

export * from './lib/processors/cli-speed-test-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliSpeedTestCommandProcessor } from './lib/processors/cli-speed-test-command-processor';
import { API_VERSION } from './lib/version';

export const speedTestModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-speed-test',
    processors: [new CliSpeedTestCommandProcessor()],
    translations: {
        es: { 'cli.speed-test.description': 'Ejecutar una prueba de velocidad de internet' },
        fr: { 'cli.speed-test.description': 'Lancer un test de débit internet' },
        de: { 'cli.speed-test.description': 'Internet-Geschwindigkeitstest durchführen' },
        pt: { 'cli.speed-test.description': 'Executar um teste de velocidade de internet' },
        it: { 'cli.speed-test.description': 'Eseguire un test di velocità internet' },
        ja: { 'cli.speed-test.description': 'インターネット速度テストを実行' },
        ko: { 'cli.speed-test.description': '인터넷 속도 테스트 실행' },
        zh: { 'cli.speed-test.description': '运行网络速度测试' },
        ru: { 'cli.speed-test.description': 'Запустить тест скорости интернета' },
        ro: { 'cli.speed-test.description': 'Rulează un test de viteză a internetului' },
    },
};

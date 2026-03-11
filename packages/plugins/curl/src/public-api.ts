/*
 * Public API Surface of curl
 */

export * from './lib/utilities';
export * from './lib/processors/cli-curl-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliCurlCommandProcessor } from './lib/processors/cli-curl-command-processor';
import { API_VERSION } from './lib/version';

export const curlModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-curl',
    processors: [new CliCurlCommandProcessor()],
    translations: {
        es: { 'cli.curl.description': 'Realizar solicitudes HTTP desde la terminal' },
        fr: { 'cli.curl.description': 'Effectuer des requêtes HTTP depuis le terminal' },
        de: { 'cli.curl.description': 'HTTP-Anfragen vom Terminal ausführen' },
        pt: { 'cli.curl.description': 'Fazer requisições HTTP pelo terminal' },
        it: { 'cli.curl.description': 'Eseguire richieste HTTP dal terminale' },
        ja: { 'cli.curl.description': 'ターミナルからHTTPリクエストを実行' },
        ko: { 'cli.curl.description': '터미널에서 HTTP 요청 수행' },
        zh: { 'cli.curl.description': '从终端发送 HTTP 请求' },
        ru: { 'cli.curl.description': 'Выполнение HTTP-запросов из терминала' },
        ro: { 'cli.curl.description': 'Efectuează cereri HTTP din terminal' },
    },
};

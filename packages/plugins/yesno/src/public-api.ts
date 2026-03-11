/*
 * Public API Surface of yesno
 */

export * from './lib/processors/cli-yesno-command-processor';

export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliYesnoCommandProcessor } from './lib/processors/cli-yesno-command-processor';
import { API_VERSION } from './lib/version';

export const yesnoModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-yesno',
    processors: [new CliYesnoCommandProcessor()],
    translations: {
        es: { 'cli.yesno.description': 'Generar una respuesta aleatoria de sí o no' },
        fr: { 'cli.yesno.description': 'Générer une réponse aléatoire oui/non' },
        de: { 'cli.yesno.description': 'Zufällige Ja/Nein-Antwort generieren' },
        pt: { 'cli.yesno.description': 'Gerar uma resposta aleatória de sim ou não' },
        it: { 'cli.yesno.description': 'Generare una risposta casuale sì/no' },
        ja: { 'cli.yesno.description': 'ランダムにはい/いいえを生成' },
        ko: { 'cli.yesno.description': '무작위 예/아니오 답변 생성' },
        zh: { 'cli.yesno.description': '随机生成是/否答案' },
        ru: { 'cli.yesno.description': 'Сгенерировать случайный ответ да/нет' },
        ro: { 'cli.yesno.description': 'Generează un răspuns aleatoriu da/nu' },
    },
};

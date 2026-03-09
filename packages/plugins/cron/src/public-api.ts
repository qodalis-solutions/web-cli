/*
 * Public API Surface of cron
 */

export * from './lib/processors/cli-cron-command-processor';
export * from './lib/cron-utils';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliCronCommandProcessor } from './lib/processors/cli-cron-command-processor';
import { API_VERSION } from './lib/version';

export const cronModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-cron',
    processors: [new CliCronCommandProcessor()],
    translations: {
        es: { 'cli.cron.description': 'Programar comandos para ejecución periódica' },
        fr: { 'cli.cron.description': 'Planifier des commandes à exécution périodique' },
        de: { 'cli.cron.description': 'Befehle für regelmäßige Ausführung planen' },
        pt: { 'cli.cron.description': 'Agendar comandos para execução periódica' },
        it: { 'cli.cron.description': 'Pianificare comandi a esecuzione periodica' },
        ja: { 'cli.cron.description': 'コマンドの定期実行をスケジュール' },
        ko: { 'cli.cron.description': '명령어를 주기적으로 실행하도록 예약' },
        zh: { 'cli.cron.description': '定时重复执行命令' },
        ru: { 'cli.cron.description': 'Планирование периодического выполнения команд' },
        ro: { 'cli.cron.description': 'Programează comenzi pentru execuție periodică' },
    },
};

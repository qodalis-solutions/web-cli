/*
 * Public API Surface of server-logs
 */

export * from './lib/processors/cli-logs-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliLogsCommandProcessor } from './lib/processors/cli-logs-command-processor';
import { API_VERSION } from './lib/version';

export const serverLogsModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-server-logs',
    processors: [new CliLogsCommandProcessor()],
    translations: {
        es: { 'cli.server-logs.description': 'Mostrar registros en tiempo real' },
        fr: { 'cli.server-logs.description': 'Afficher les journaux en direct' },
        de: { 'cli.server-logs.description': 'Live-Protokolle anzeigen' },
        pt: { 'cli.server-logs.description': 'Mostrar logs em tempo real' },
        it: { 'cli.server-logs.description': 'Mostrare i log in tempo reale' },
        ja: { 'cli.server-logs.description': 'ライブログを表示' },
        ko: { 'cli.server-logs.description': '실시간 로그 표시' },
        zh: { 'cli.server-logs.description': '显示实时日志' },
        ru: { 'cli.server-logs.description': 'Показать журналы в реальном времени' },
        ro: { 'cli.server-logs.description': 'Afișează jurnalele în timp real' },
    },
};

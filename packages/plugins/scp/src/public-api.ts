/*
 * Public API Surface of scp
 */

export * from './lib/processors/cli-scp-command-processor';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliScpCommandCommandProcessor } from './lib/processors/cli-scp-command-processor';
import { ScpTransferService } from './lib/services/scp-transfer.service';
import { IScpTransferService_TOKEN } from './lib/interfaces';
import { API_VERSION } from './lib/version';

export const scpModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-scp',
    processors: [new CliScpCommandCommandProcessor()],
    services: [
        {
            provide: IScpTransferService_TOKEN,
            useValue: new ScpTransferService(),
        },
    ],
    translations: {
        es: { 'cli.scp.description': 'Transferencia de archivos tipo SCP' },
        fr: { 'cli.scp.description': 'Transfert de fichiers de type SCP' },
        de: { 'cli.scp.description': 'SCP-ähnliche Dateiübertragung' },
        pt: { 'cli.scp.description': 'Transferência de arquivos tipo SCP' },
        it: { 'cli.scp.description': 'Trasferimento file di tipo SCP' },
        ja: { 'cli.scp.description': 'SCP風ファイル転送' },
        ko: { 'cli.scp.description': 'SCP 방식 파일 전송' },
        zh: { 'cli.scp.description': 'SCP 风格文件传输' },
        ru: { 'cli.scp.description': 'Передача файлов в стиле SCP' },
        ro: { 'cli.scp.description': 'Transfer de fișiere de tip SCP' },
    },
};

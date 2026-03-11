/*
 * Public API Surface of wget
 */

export * from './lib/processors/cli-wget-command-processor';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliWgetCommandCommandProcessor } from './lib/processors/cli-wget-command-processor';
import { API_VERSION } from './lib/version';

export const wgetModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-wget',
    processors: [new CliWgetCommandCommandProcessor()],
    translations: {
        es: { 'cli.wget.description': 'Descargar archivos desde cualquier URL HTTP/HTTPS' },
        fr: { 'cli.wget.description': 'Télécharger des fichiers depuis une URL HTTP/HTTPS' },
        de: { 'cli.wget.description': 'Dateien von beliebigen HTTP/HTTPS-URLs herunterladen' },
        pt: { 'cli.wget.description': 'Baixar arquivos de qualquer URL HTTP/HTTPS' },
        it: { 'cli.wget.description': 'Scaricare file da qualsiasi URL HTTP/HTTPS' },
        ja: { 'cli.wget.description': 'HTTP/HTTPS URLからファイルをダウンロード' },
        ko: { 'cli.wget.description': 'HTTP/HTTPS URL에서 파일 다운로드' },
        zh: { 'cli.wget.description': '从任意 HTTP/HTTPS URL 下载文件' },
        ru: { 'cli.wget.description': 'Скачивание файлов по HTTP/HTTPS' },
        ro: { 'cli.wget.description': 'Descarcă fișiere de la orice URL HTTP/HTTPS' },
    },
};

/*
 * Public API Surface of qr
 */

export * from './lib/processors/cli-qr-command-processor';

export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliQrCommandProcessor } from './lib/processors/cli-qr-command-processor';
import { API_VERSION } from './lib/version';

export const qrModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-qr',
    processors: [new CliQrCommandProcessor()],
    translations: {
        es: { 'cli.qr.description': 'Generar códigos QR' },
        fr: { 'cli.qr.description': 'Générer des codes QR' },
        de: { 'cli.qr.description': 'QR-Codes generieren' },
        pt: { 'cli.qr.description': 'Gerar códigos QR' },
        it: { 'cli.qr.description': 'Generare codici QR' },
        ja: { 'cli.qr.description': 'QRコードを生成' },
        ko: { 'cli.qr.description': 'QR 코드 생성' },
        zh: { 'cli.qr.description': '生成二维码' },
        ru: { 'cli.qr.description': 'Генерация QR-кодов' },
        ro: { 'cli.qr.description': 'Generare coduri QR' },
    },
};

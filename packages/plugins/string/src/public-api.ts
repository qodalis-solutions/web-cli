/*
 * Public API Surface of string
 */

export * from './lib/processors/cli-string-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliStringCommandProcessor } from './lib/processors/cli-string-command-processor';
import { API_VERSION } from './lib/version';

export const stringModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-string',
    processors: [new CliStringCommandProcessor()],
    translations: {
        es: { 'cli.string.description': 'Utilidades de transformación de cadenas' },
        fr: { 'cli.string.description': 'Utilitaires de transformation de chaînes' },
        de: { 'cli.string.description': 'Zeichenketten-Transformationswerkzeuge' },
        pt: { 'cli.string.description': 'Utilitários de transformação de strings' },
        it: { 'cli.string.description': 'Utilità di trasformazione stringhe' },
        ja: { 'cli.string.description': '文字列変換ユーティリティ' },
        ko: { 'cli.string.description': '문자열 변환 유틸리티' },
        zh: { 'cli.string.description': '字符串转换工具' },
        ru: { 'cli.string.description': 'Утилиты преобразования строк' },
        ro: { 'cli.string.description': 'Utilitare de transformare a șirurilor de caractere' },
    },
};

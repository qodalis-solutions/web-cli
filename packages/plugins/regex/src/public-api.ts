/*
 * Public API Surface of regex
 */

export * from './lib/processors/cli-regex-command-processor';
export * from './lib/utilities';

import { ICliModule } from '@qodalis/cli-core';
import { CliRegexCommandProcessor } from './lib/processors/cli-regex-command-processor';
import { API_VERSION } from './lib/version';

export const regexModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-regex',
    processors: [new CliRegexCommandProcessor()],
    translations: {
        es: { 'cli.regex.description': 'Utilidades para trabajar con expresiones regulares' },
        fr: { 'cli.regex.description': 'Utilitaires pour les expressions régulières' },
        de: { 'cli.regex.description': 'Hilfsmittel für reguläre Ausdrücke' },
        pt: { 'cli.regex.description': 'Utilitários para expressões regulares' },
        it: { 'cli.regex.description': 'Utilità per le espressioni regolari' },
        ja: { 'cli.regex.description': '正規表現ユーティリティ' },
        ko: { 'cli.regex.description': '정규 표현식 유틸리티' },
        zh: { 'cli.regex.description': '正则表达式工具' },
        ru: { 'cli.regex.description': 'Утилиты для работы с регулярными выражениями' },
        ro: { 'cli.regex.description': 'Utilitare pentru expresii regulate' },
    },
};

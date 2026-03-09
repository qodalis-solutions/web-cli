/*
 * Public API Surface of guid
 */

export * from './lib/utilities';
export type { GuidFormat } from './lib/utilities';

export * from './lib/processors/cli-guid-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliGuidCommandProcessor } from './lib/processors/cli-guid-command-processor';
import { API_VERSION } from './lib/version';

export const guidModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-guid',
    processors: [new CliGuidCommandProcessor()],
    translations: {
        es: { 'cli.guid.description': 'Generar, validar, formatear e inspeccionar UUIDs' },
        fr: { 'cli.guid.description': 'Générer, valider, formater et inspecter des UUIDs' },
        de: { 'cli.guid.description': 'UUIDs generieren, validieren, formatieren und inspizieren' },
        pt: { 'cli.guid.description': 'Gerar, validar, formatar e inspecionar UUIDs' },
        it: { 'cli.guid.description': 'Generare, validare, formattare e ispezionare UUID' },
        ja: { 'cli.guid.description': 'UUIDの生成、検証、フォーマット、検査' },
        ko: { 'cli.guid.description': 'UUID 생성, 검증, 포맷 및 검사' },
        zh: { 'cli.guid.description': '生成、验证、格式化和检查 UUID' },
        ru: { 'cli.guid.description': 'Генерация, проверка, форматирование и анализ UUID' },
        ro: { 'cli.guid.description': 'Generare, validare, formatare și inspectare UUID-uri' },
    },
};

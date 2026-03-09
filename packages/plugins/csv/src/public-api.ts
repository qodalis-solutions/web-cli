/*
 * Public API Surface of csv
 */

export * from './lib/processors/cli-csv-command-processor';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliCsvCommandProcessor } from './lib/processors/cli-csv-command-processor';
import { API_VERSION } from './lib/version';

export const csvModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-csv',
    processors: [new CliCsvCommandProcessor()],
    translations: {
        es: { 'cli.csv.description': 'Analizar, filtrar, ordenar y convertir datos CSV' },
        fr: { 'cli.csv.description': 'Analyser, filtrer, trier et convertir des données CSV' },
        de: { 'cli.csv.description': 'CSV-Daten parsen, filtern, sortieren und konvertieren' },
        pt: { 'cli.csv.description': 'Analisar, filtrar, ordenar e converter dados CSV' },
        it: { 'cli.csv.description': 'Analizzare, filtrare, ordinare e convertire dati CSV' },
        ja: { 'cli.csv.description': 'CSVデータの解析、フィルタ、ソート、変換' },
        ko: { 'cli.csv.description': 'CSV 데이터 구문 분석, 필터, 정렬 및 변환' },
        zh: { 'cli.csv.description': '解析、过滤、排序和转换 CSV 数据' },
        ru: { 'cli.csv.description': 'Разбор, фильтрация, сортировка и преобразование CSV' },
        ro: { 'cli.csv.description': 'Analizare, filtrare, sortare și conversie date CSV' },
    },
};

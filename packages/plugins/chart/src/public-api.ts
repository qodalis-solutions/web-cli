/*
 * Public API Surface of chart
 */

export * from './lib/processors/cli-chart-command-processor';
export * from './lib/chart-utils';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliChartCommandProcessor } from './lib/processors/cli-chart-command-processor';
import { API_VERSION } from './lib/version';

export const chartModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-chart',
    processors: [new CliChartCommandProcessor()],
    translations: {
        es: { 'cli.chart.description': 'Renderizar gráficos ASCII a partir de datos' },
        fr: { 'cli.chart.description': 'Afficher des graphiques ASCII à partir de données' },
        de: { 'cli.chart.description': 'ASCII-Diagramme aus Daten rendern' },
        pt: { 'cli.chart.description': 'Renderizar gráficos ASCII a partir de dados' },
        it: { 'cli.chart.description': 'Renderizzare grafici ASCII dai dati' },
        ja: { 'cli.chart.description': 'データからASCIIチャートを描画' },
        ko: { 'cli.chart.description': '데이터를 ASCII 차트로 렌더링' },
        zh: { 'cli.chart.description': '将数据渲染为 ASCII 图表' },
        ru: { 'cli.chart.description': 'Построение ASCII-графиков из данных' },
        ro: { 'cli.chart.description': 'Redare grafice ASCII din date' },
    },
};

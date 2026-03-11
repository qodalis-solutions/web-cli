/*
 * Public API Surface of markdown
 */

export * from './lib/processors/cli-markdown-command-processor';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliMarkdownCommandProcessor } from './lib/processors/cli-markdown-command-processor';
import { API_VERSION } from './lib/version';

export const markdownModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-markdown',
    processors: [new CliMarkdownCommandProcessor()],
    translations: {
        es: { 'cli.md.description': 'Renderizar Markdown en la terminal' },
        fr: { 'cli.md.description': 'Afficher du Markdown dans le terminal' },
        de: { 'cli.md.description': 'Markdown im Terminal rendern' },
        pt: { 'cli.md.description': 'Renderizar Markdown no terminal' },
        it: { 'cli.md.description': 'Renderizzare Markdown nel terminale' },
        ja: { 'cli.md.description': 'ターミナルでMarkdownを描画' },
        ko: { 'cli.md.description': '터미널에서 Markdown 렌더링' },
        zh: { 'cli.md.description': '在终端中渲染 Markdown' },
        ru: { 'cli.md.description': 'Рендеринг Markdown в терминале' },
        ro: { 'cli.md.description': 'Redare Markdown în terminal' },
    },
};

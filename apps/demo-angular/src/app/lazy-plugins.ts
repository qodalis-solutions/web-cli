import type { ICliModule } from '@qodalis/cli-core';

/**
 * Plugin modules that are code-split out of the initial bundle.
 *
 * Each `import()` becomes its own lazy chunk, so the initial chunk only holds
 * Angular, the CLI engine and the few plugins registered through DI in
 * AppModule. The chunks download in parallel right after bootstrap, and
 * AppComponent renders the terminal once they are in, so every module is
 * still passed to the engine before it boots (same boot as eager imports).
 *
 * The order of the list is the order the modules are passed to the engine.
 */
const loaders: (() => Promise<ICliModule>)[] = [
    // Tools and games
    () => import('@qodalis/cli-files').then((m) => m.filesModule),
    () => import('@qodalis/cli-curl').then((m) => m.curlModule),
    () => import('@qodalis/cli-password-generator').then((m) => m.passwordGeneratorModule),
    () => import('@qodalis/cli-qr').then((m) => m.qrModule),
    () => import('@qodalis/cli-yesno').then((m) => m.yesnoModule),
    () => import('@qodalis/cli-server-logs').then((m) => m.serverLogsModule),
    () => import('@qodalis/cli-snake').then((m) => m.snakeModule),
    () => import('@qodalis/cli-tetris').then((m) => m.tetrisModule),
    () => import('@qodalis/cli-2048').then((m) => m.game2048Module),
    () => import('@qodalis/cli-minesweeper').then((m) => m.minesweeperModule),
    () => import('@qodalis/cli-wordle').then((m) => m.wordleModule),
    () => import('@qodalis/cli-scp').then((m) => m.scpModule),
    () => import('@qodalis/cli-wget').then((m) => m.wgetModule),
    () => import('@qodalis/cli-sudoku').then((m) => m.sudokuModule),
    () => import('@qodalis/cli-server-jobs').then((m) => m.jobsModule),
    () => import('@qodalis/cli-encode').then((m) => m.encodeModule),
    () => import('@qodalis/cli-markdown').then((m) => m.markdownModule),
    () => import('@qodalis/cli-data-explorer').then((m) => m.dataExplorerModule),
    () => import('./processors/cli-input-demo-command-processor').then((m) => ({
        apiVersion: 2,
        name: 'input-demo',
        processors: [new m.CliInputDemoCommandProcessor()],
    })),
    // Translations (about 190 kB together)
    () => import('@qodalis/cli-lang-es').then((m) => m.langEsModule),
    () => import('@qodalis/cli-lang-fr').then((m) => m.langFrModule),
    () => import('@qodalis/cli-lang-de').then((m) => m.langDeModule),
    () => import('@qodalis/cli-lang-pt').then((m) => m.langPtModule),
    () => import('@qodalis/cli-lang-it').then((m) => m.langItModule),
    () => import('@qodalis/cli-lang-ja').then((m) => m.langJaModule),
    () => import('@qodalis/cli-lang-ko').then((m) => m.langKoModule),
    () => import('@qodalis/cli-lang-zh').then((m) => m.langZhModule),
    () => import('@qodalis/cli-lang-ru').then((m) => m.langRuModule),
    () => import('@qodalis/cli-lang-ro').then((m) => m.langRoModule),
];

/** Load every lazy plugin module in parallel. A chunk that fails to load is skipped. */
export async function loadLazyPlugins(): Promise<ICliModule[]> {
    const results = await Promise.allSettled(loaders.map((load) => load()));
    return results.flatMap((r) => {
        if (r.status === 'fulfilled') return [r.value];
        console.error('[demo] Failed to load a CLI plugin chunk', r.reason);
        return [];
    });
}

import { defineConfig } from 'tsup';
import { sharedConfig } from '../../../tsup.shared';

export default defineConfig([
    {
        ...sharedConfig,
        entry: ['src/public-api.ts'],
        outDir: '../../../dist/sudoku',
        external: ['@qodalis/cli-core'],
    },
    {
        entry: ['src/cli-entrypoint.ts'],
        format: ['iife'],
        outDir: '../../../dist/sudoku/umd',
        globalName: 'sudoku',
        platform: 'browser',
        external: [],
        noExternal: [/.*/],
    },
]);

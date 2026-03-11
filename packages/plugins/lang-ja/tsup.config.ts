import { defineConfig } from 'tsup';
import { sharedConfig } from '../../../tsup.shared';

export default defineConfig([
    {
        ...sharedConfig,
        entry: ['src/public-api.ts'],
        outDir: '../../../dist/lang-ja',
        external: ['@qodalis/cli-core'],
    },
    {
        entry: { index: 'src/cli-entrypoint.ts' },
        format: ['iife'],
        outDir: '../../../dist/lang-ja/umd',
        globalName: 'langJa',
        platform: 'browser',
        external: [],
        noExternal: [/.*/],
    },
]);

import { defineConfig } from 'tsup';
import { sharedConfig } from '../../../tsup.shared';

export default defineConfig([
    {
        ...sharedConfig,
        entry: ['src/public-api.ts'],
        outDir: '../../../dist/lang-de',
        external: ['@qodalis/cli-core'],
    },
    {
        entry: { index: 'src/cli-entrypoint.ts' },
        format: ['iife'],
        outDir: '../../../dist/lang-de/umd',
        globalName: 'langDe',
        platform: 'browser',
        external: [],
        noExternal: [/.*/],
    },
]);

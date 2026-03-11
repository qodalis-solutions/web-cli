import { defineConfig } from 'tsup';
import { sharedConfig } from '../../../tsup.shared';

export default defineConfig([
    {
        ...sharedConfig,
        entry: ['src/public-api.ts'],
        outDir: '../../../dist/lang-es',
        external: ['@qodalis/cli-core'],
    },
    {
        entry: { index: 'src/cli-entrypoint.ts' },
        format: ['iife'],
        outDir: '../../../dist/lang-es/umd',
        globalName: 'langEs',
        platform: 'browser',
        external: [],
        noExternal: [/.*/],
    },
]);

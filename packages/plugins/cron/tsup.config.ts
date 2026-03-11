import { defineConfig } from 'tsup';
import { sharedConfig } from '../../../tsup.shared';

export default defineConfig([
    {
        ...sharedConfig,
        entry: ['src/public-api.ts'],
        outDir: '../../../dist/cron',
        external: ['@qodalis/cli-core'],
    },
    {
        entry: { index: 'src/cli-entrypoint.ts' },
        format: ['iife'],
        outDir: '../../../dist/cron/umd',
        globalName: 'cron',
        platform: 'browser',
        external: [],
        noExternal: [/.*/],
    },
]);

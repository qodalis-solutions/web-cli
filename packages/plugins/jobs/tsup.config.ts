import { defineConfig } from 'tsup';
import { sharedConfig } from '../../../tsup.shared';

export default defineConfig([
    {
        ...sharedConfig,
        entry: ['src/public-api.ts'],
        outDir: '../../../dist/jobs',
        external: ['@qodalis/cli-core'],
    },
    {
        entry: { index: 'src/cli-entrypoint.ts' },
        format: ['iife'],
        outDir: '../../../dist/jobs/umd',
        globalName: 'jobs',
        platform: 'browser',
        external: [],
        noExternal: [/.*/],
    },
]);

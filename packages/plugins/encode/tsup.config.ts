import { defineConfig } from 'tsup';
import { sharedConfig } from '../../../tsup.shared';

export default defineConfig([
    {
        ...sharedConfig,
        entry: ['src/public-api.ts'],
        outDir: '../../../dist/encode',
        external: ['@qodalis/cli-core'],
    },
    {
        entry: ['src/cli-entrypoint.ts'],
        format: ['iife'],
        outDir: '../../../dist/encode/umd',
        globalName: 'encode',
        platform: 'browser',
        external: [],
        noExternal: [/.*/],
    },
]);

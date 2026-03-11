import { defineConfig } from 'tsup';
import { sharedConfig } from '../../../tsup.shared';

export default defineConfig([
    {
        ...sharedConfig,
        entry: ['src/public-api.ts'],
        outDir: '../../../dist/text-to-image',
        external: ['@qodalis/cli-core'],
    },
    {
        entry: ['src/cli-entrypoint.ts'],
        format: ['iife'],
        outDir: '../../../dist/text-to-image/umd',
        globalName: 'textToImage',
        platform: 'browser',
        external: [],
        noExternal: [/.*/],
    },
]);

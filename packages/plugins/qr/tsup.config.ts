import { defineConfig } from 'tsup';
import { sharedConfig } from '../../../tsup.shared';

export default defineConfig([
    {
        ...sharedConfig,
        entry: ['src/public-api.ts'],
        outDir: '../../../dist/qr',
        external: ['@qodalis/cli-core', 'qr-code-styling'],
    },
    {
        entry: ['src/cli-entrypoint.ts'],
        format: ['iife'],
        outDir: '../../../dist/qr/umd',
        globalName: 'qr',
        platform: 'browser',
        external: [],
        noExternal: [/.*/],
    },
]);

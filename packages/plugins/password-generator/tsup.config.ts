import { defineConfig } from 'tsup';
import { sharedConfig } from '../../../tsup.shared';

export default defineConfig([
    {
        ...sharedConfig,
        entry: ['src/public-api.ts'],
        outDir: '../../../dist/password-generator',
        external: ['@qodalis/cli-core'],
    },
    {
        entry: ['src/cli-entrypoint.ts'],
        format: ['iife'],
        outDir: '../../../dist/password-generator/umd',
        globalName: 'passwordGenerator',
        platform: 'browser',
        external: [],
        noExternal: [/.*/],
    },
]);

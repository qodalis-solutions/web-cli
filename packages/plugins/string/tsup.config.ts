import { defineConfig } from 'tsup';
import { sharedConfig } from '../../../tsup.shared';

export default defineConfig([
    {
        ...sharedConfig,
        entry: ['src/public-api.ts'],
        outDir: '../../../dist/string',
        external: ['@qodalis/cli-core', 'lodash'],
    },
    {
        entry: ['src/cli-entrypoint.ts'],
        format: ['iife'],
        outDir: '../../../dist/string/umd',
        globalName: 'string',
        platform: 'browser',
        external: [],
        noExternal: [/.*/],
    },
]);

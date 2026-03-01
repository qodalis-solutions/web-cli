import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs'],
    dts: true,
    clean: true,
    splitting: false,
    treeshake: true,
    banner: {
        js: '#!/usr/bin/env node',
    },
    outDir: '../../dist/create-cli-plugin',
    noExternal: [/(.*)/],
    platform: 'node',
    target: 'node18',
});

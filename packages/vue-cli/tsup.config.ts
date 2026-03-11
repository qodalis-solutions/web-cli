import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['vue', '@qodalis/cli', '@qodalis/cli-core'],
    outDir: 'dist',
});

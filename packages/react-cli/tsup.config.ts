import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.tsx'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom', '@qodalis/cli', '@qodalis/cli-core'],
    outDir: 'dist',
    jsx: 'automatic',
});

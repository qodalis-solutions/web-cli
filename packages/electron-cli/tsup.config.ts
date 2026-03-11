import { defineConfig } from 'tsup';

export default defineConfig([
    // Renderer-side entry (services + module)
    {
        entry: { index: 'src/index.ts' },
        format: ['cjs', 'esm'],
        dts: true,
        sourcemap: true,
        clean: true,
        external: ['electron', '@qodalis/cli', '@qodalis/cli-core'],
        outDir: 'dist',
    },
    // Preload entry (exposes IPC bridge via contextBridge)
    {
        entry: { preload: 'src/preload.ts' },
        format: ['cjs', 'esm'],
        dts: true,
        sourcemap: true,
        external: ['electron'],
        outDir: 'dist',
        clean: false,
    },
    // Main process entry (IPC handlers)
    {
        entry: { main: 'src/main.ts' },
        format: ['cjs', 'esm'],
        dts: true,
        sourcemap: true,
        external: ['electron'],
        outDir: 'dist',
        clean: false,
    },
]);

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    root: 'src/renderer',
    base: './',
    build: {
        outDir: '../../out/renderer',
        emptyOutDir: true,
    },
    // The game plugins come from npm (qodalis-solutions/cli-games) and import @qodalis/cli-core, which the alias
    // below points at dist/core. Pre-bundling them would give them their own copy of core in dev mode.
    optimizeDeps: {
        exclude: [
            '@qodalis/cli-2048',
            '@qodalis/cli-minesweeper',
            '@qodalis/cli-snake',
            '@qodalis/cli-tetris',
            '@qodalis/cli-wordle',
        ],
    },
    resolve: {
        preserveSymlinks: false,
        alias: {
            '@qodalis/cli-core': path.resolve(import.meta.dirname, '../../dist/core'),
            '@qodalis/cli': path.resolve(import.meta.dirname, '../../dist/cli'),
            '@qodalis/react-cli': path.resolve(
                import.meta.dirname,
                '../../packages/react-cli',
            ),
            '@qodalis/electron-cli': path.resolve(
                import.meta.dirname,
                '../../packages/electron-cli/src',
            ),
            '@qodalis/cli-guid': path.resolve(
                import.meta.dirname,
                '../../dist/guid/public-api.mjs',
            ),
            '@qodalis/cli-regex': path.resolve(
                import.meta.dirname,
                '../../dist/regex/public-api.mjs',
            ),
            '@qodalis/cli-text-to-image': path.resolve(
                import.meta.dirname,
                '../../dist/text-to-image/public-api.mjs',
            ),
            '@qodalis/cli-speed-test': path.resolve(
                import.meta.dirname,
                '../../dist/speed-test/public-api.mjs',
            ),
            '@qodalis/cli-browser-storage': path.resolve(
                import.meta.dirname,
                '../../dist/browser-storage/public-api.mjs',
            ),
            '@qodalis/cli-string': path.resolve(
                import.meta.dirname,
                '../../dist/string/public-api.mjs',
            ),
            '@qodalis/cli-todo': path.resolve(
                import.meta.dirname,
                '../../dist/todo/public-api.mjs',
            ),
            '@qodalis/cli-curl': path.resolve(
                import.meta.dirname,
                '../../dist/curl/public-api.mjs',
            ),
            '@qodalis/cli-password-generator': path.resolve(
                import.meta.dirname,
                '../../dist/password-generator/public-api.mjs',
            ),
            '@qodalis/cli-qr': path.resolve(
                import.meta.dirname,
                '../../dist/qr/public-api.mjs',
            ),
            '@qodalis/cli-yesno': path.resolve(
                import.meta.dirname,
                '../../dist/yesno/public-api.mjs',
            ),
            '@qodalis/cli-server-logs': path.resolve(
                import.meta.dirname,
                '../../dist/server-logs/public-api.mjs',
            ),
            '@qodalis/cli-users': path.resolve(
                import.meta.dirname,
                '../../dist/users/public-api.mjs',
            ),
            '@qodalis/cli-files': path.resolve(
                import.meta.dirname,
                '../../dist/files/public-api.mjs',
            ),
            '@qodalis/cli-scp': path.resolve(
                import.meta.dirname,
                '../../dist/scp/public-api.mjs',
            ),
            '@qodalis/cli-wget': path.resolve(
                import.meta.dirname,
                '../../dist/wget/public-api.mjs',
            ),
        },
    },
});

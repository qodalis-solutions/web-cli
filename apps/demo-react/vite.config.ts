import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api/cli': {
                target: 'http://localhost:8046',
                changeOrigin: true,
            },
            '/ws/cli': {
                target: 'http://localhost:8046',
                changeOrigin: true,
                ws: true,
            },
        },
    },
    resolve: {
        // Resolve symlinked local packages from the demo-react node_modules
        // so that transitive imports (e.g. @qodalis/cli -> @qodalis/cli-core)
        // are found correctly.
        preserveSymlinks: false,
        alias: {
            '@qodalis/cli-core': path.resolve(__dirname, '../../dist/core'),
            '@qodalis/cli': path.resolve(__dirname, '../../dist/cli'),
            '@qodalis/react-cli': path.resolve(
                __dirname,
                '../../packages/react-cli',
            ),
            '@qodalis/cli-guid': path.resolve(
                __dirname,
                '../../dist/guid/public-api.mjs',
            ),
            '@qodalis/cli-regex': path.resolve(
                __dirname,
                '../../dist/regex/public-api.mjs',
            ),
            '@qodalis/cli-text-to-image': path.resolve(
                __dirname,
                '../../dist/text-to-image/public-api.mjs',
            ),
            '@qodalis/cli-speed-test': path.resolve(
                __dirname,
                '../../dist/speed-test/public-api.mjs',
            ),
            '@qodalis/cli-browser-storage': path.resolve(
                __dirname,
                '../../dist/browser-storage/public-api.mjs',
            ),
            '@qodalis/cli-string': path.resolve(
                __dirname,
                '../../dist/string/public-api.mjs',
            ),
            '@qodalis/cli-todo': path.resolve(
                __dirname,
                '../../dist/todo/public-api.mjs',
            ),
            '@qodalis/cli-curl': path.resolve(
                __dirname,
                '../../dist/curl/public-api.mjs',
            ),
            '@qodalis/cli-password-generator': path.resolve(
                __dirname,
                '../../dist/password-generator/public-api.mjs',
            ),
            '@qodalis/cli-qr': path.resolve(
                __dirname,
                '../../dist/qr/public-api.mjs',
            ),
            '@qodalis/cli-yesno': path.resolve(
                __dirname,
                '../../dist/yesno/public-api.mjs',
            ),
            '@qodalis/cli-server-logs': path.resolve(
                __dirname,
                '../../dist/server-logs/public-api.mjs',
            ),
            '@qodalis/cli-users': path.resolve(
                __dirname,
                '../../dist/users/public-api.mjs',
            ),
            '@qodalis/cli-files': path.resolve(
                __dirname,
                '../../dist/files/public-api.mjs',
            ),
            '@qodalis/cli-snake': path.resolve(
                __dirname,
                '../../dist/snake/public-api.mjs',
            ),
            '@qodalis/cli-tetris': path.resolve(
                __dirname,
                '../../dist/tetris/public-api.mjs',
            ),
            '@qodalis/cli-2048': path.resolve(
                __dirname,
                '../../dist/2048/public-api.mjs',
            ),
            '@qodalis/cli-minesweeper': path.resolve(
                __dirname,
                '../../dist/minesweeper/public-api.mjs',
            ),
            '@qodalis/cli-wordle': path.resolve(
                __dirname,
                '../../dist/wordle/public-api.mjs',
            ),
            '@qodalis/cli-scp': path.resolve(
                __dirname,
                '../../dist/scp/public-api.mjs',
            ),
            '@qodalis/cli-wget': path.resolve(
                __dirname,
                '../../dist/wget/public-api.mjs',
            ),
        },
    },
});

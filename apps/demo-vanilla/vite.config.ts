import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
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
        preserveSymlinks: false,
        alias: {
            '@qodalis/cli-core': path.resolve(__dirname, '../../dist/core'),
            '@qodalis/cli': path.resolve(__dirname, '../../dist/cli'),
            '@qodalis/cli-guid': path.resolve(
                __dirname,
                '../../dist/guid/public-api.mjs',
            ),
            '@qodalis/cli-string': path.resolve(
                __dirname,
                '../../dist/string/public-api.mjs',
            ),
            '@qodalis/cli-password-generator': path.resolve(
                __dirname,
                '../../dist/password-generator/public-api.mjs',
            ),
            '@qodalis/cli-qr': path.resolve(
                __dirname,
                '../../dist/qr/public-api.mjs',
            ),
            '@qodalis/cli-todo': path.resolve(
                __dirname,
                '../../dist/todo/public-api.mjs',
            ),
        },
    },
});

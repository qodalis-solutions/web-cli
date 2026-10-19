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
            '@qodalis/cli-core': path.resolve(import.meta.dirname, '../../dist/core'),
            '@qodalis/cli': path.resolve(import.meta.dirname, '../../dist/cli'),
            '@qodalis/cli-guid': path.resolve(
                import.meta.dirname,
                '../../dist/guid/public-api.mjs',
            ),
            '@qodalis/cli-string': path.resolve(
                import.meta.dirname,
                '../../dist/string/public-api.mjs',
            ),
            '@qodalis/cli-password-generator': path.resolve(
                import.meta.dirname,
                '../../dist/password-generator/public-api.mjs',
            ),
            '@qodalis/cli-qr': path.resolve(
                import.meta.dirname,
                '../../dist/qr/public-api.mjs',
            ),
            '@qodalis/cli-todo': path.resolve(
                import.meta.dirname,
                '../../dist/todo/public-api.mjs',
            ),
            '@qodalis/cli-markdown': path.resolve(
                import.meta.dirname,
                '../../dist/markdown/public-api.mjs',
            ),
        },
    },
});

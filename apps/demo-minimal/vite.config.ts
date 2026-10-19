import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        preserveSymlinks: false,
        alias: {
            '@qodalis/cli-core': path.resolve(import.meta.dirname, '../../dist/core'),
            '@qodalis/cli': path.resolve(import.meta.dirname, '../../dist/cli'),
            '@qodalis/react-cli': path.resolve(
                import.meta.dirname,
                '../../packages/react-cli',
            ),
        },
    },
});

import { defineConfig } from 'tsup';
import { sharedConfig } from '../../tsup.shared';

export default defineConfig({
    ...sharedConfig,
    entry: ['src/public-api.ts'],
    outDir: '../../dist/core',
    external: ['@xterm/xterm'],
});

import { defineConfig } from 'tsup';
import { sharedConfig } from '../../tsup.shared';

export default defineConfig({
    ...sharedConfig,
    entry: ['src/public-api.ts'],
    outDir: '../../dist/cli',
    external: [
        '@qodalis/cli-core',
        '@xterm/xterm',
        '@xterm/addon-fit',
        '@xterm/addon-web-links',
        '@xterm/addon-unicode11',
        '@xterm/addon-serialize',
        'rxjs',
    ],
});

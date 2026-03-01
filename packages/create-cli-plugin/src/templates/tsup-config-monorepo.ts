import { TemplateVars } from './types';

export function tsupConfigMonorepoTemplate(vars: TemplateVars): string {
    return `import { defineConfig } from 'tsup';
import { sharedConfig } from '../../../tsup.shared';

export default defineConfig([
    {
        ...sharedConfig,
        entry: ['src/public-api.ts'],
        outDir: '../../../dist/${vars.name}',
        external: ['@qodalis/cli-core'],
    },
    {
        entry: ['src/cli-entrypoint.ts'],
        format: ['iife'],
        outDir: '../../../dist/${vars.name}/umd',
        globalName: '${vars.name}',
        platform: 'browser',
        external: [],
        noExternal: [/.*/],
    },
]);
`;
}

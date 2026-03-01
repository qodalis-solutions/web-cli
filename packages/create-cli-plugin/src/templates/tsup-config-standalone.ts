import { TemplateVars } from './types';

export function tsupConfigStandaloneTemplate(vars: TemplateVars): string {
    return `import { defineConfig } from 'tsup';

export default defineConfig([
    {
        entry: ['src/public-api.ts'],
        format: ['cjs', 'esm'],
        dts: true,
        sourcemap: true,
        clean: true,
        splitting: false,
        treeshake: true,
        outDir: 'dist',
        external: ['@qodalis/cli-core'],
    },
    {
        entry: ['src/cli-entrypoint.ts'],
        format: ['iife'],
        outDir: 'dist/umd',
        globalName: '${vars.name}',
        platform: 'browser',
        external: [],
        noExternal: [/.*/],
    },
]);
`;
}

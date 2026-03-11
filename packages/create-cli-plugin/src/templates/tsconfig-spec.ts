import { TemplateVars } from './types';

export function tsconfigSpecTemplate(_vars: TemplateVars): string {
    return JSON.stringify(
        {
            extends: '../../../tsconfig.json',
            compilerOptions: {
                outDir: '../../../out-tsc/spec',
                types: ['jasmine'],
            },
            include: ['**/*.spec.ts', '**/*.d.ts'],
        },
        null,
        2,
    );
}

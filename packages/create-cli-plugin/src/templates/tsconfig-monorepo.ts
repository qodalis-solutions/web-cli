import { TemplateVars } from './types';

export function tsconfigMonorepoTemplate(vars: TemplateVars): string {
    return JSON.stringify(
        {
            extends: '../../../tsconfig.base.json',
            compilerOptions: {
                outDir: `../../../dist/${vars.name}`,
                declaration: true,
                declarationMap: true,
                rootDir: 'src',
            },
            include: ['src/**/*'],
            exclude: ['**/*.spec.ts'],
        },
        null,
        2,
    );
}

import { TemplateVars } from './types';

export function tsconfigStandaloneTemplate(_vars: TemplateVars): string {
    return JSON.stringify(
        {
            compilerOptions: {
                target: 'ES2022',
                module: 'ES2022',
                moduleResolution: 'node',
                declaration: true,
                declarationMap: true,
                sourceMap: true,
                outDir: './dist',
                rootDir: 'src',
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                experimentalDecorators: true,
                lib: ['ES2022', 'dom'],
            },
            include: ['src/**/*'],
            exclude: ['**/*.spec.ts'],
        },
        null,
        2,
    );
}

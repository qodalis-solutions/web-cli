import { TemplateVars } from './types';

export function packageJsonTemplate(vars: TemplateVars, monorepo: boolean): string {
    const coreVersion = monorepo ? 'workspace:*' : '^2.0.0';
    return JSON.stringify(
        {
            name: `@qodalis/cli-${vars.name}`,
            version: vars.version,
            description: vars.description,
            author: 'Qodalis Solutions',
            license: 'MIT',
            repository: {
                type: 'git',
                url: 'https://github.com/qodalis-solutions/web-cli',
            },
            homepage: 'https://qodalis.com',
            keywords: ['cli', 'qodalis', 'terminal', vars.name],
            umd: './umd/index.js',
            unpkg: './umd/index.js',
            dependencies: {
                '@qodalis/cli-core': coreVersion,
            },
            sideEffects: false,
            main: './public-api.js',
            module: './public-api.mjs',
            types: './public-api.d.ts',
            exports: {
                '.': {
                    types: './public-api.d.ts',
                    import: './public-api.mjs',
                    require: './public-api.js',
                },
            },
        },
        null,
        2,
    );
}

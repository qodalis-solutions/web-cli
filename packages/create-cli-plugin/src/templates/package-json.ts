import { TemplateVars } from './types';

export function packageJsonTemplate(vars: TemplateVars, monorepo: boolean): string {
    const coreVersion = monorepo ? 'workspace:*' : '^0.0.16';
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
            scripts: monorepo ? undefined : {
                build: 'tsup',
            },
            dependencies: {
                '@qodalis/cli-core': coreVersion,
            },
            devDependencies: monorepo ? undefined : {
                tsup: '^8.0.0',
                typescript: '^5.0.0',
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

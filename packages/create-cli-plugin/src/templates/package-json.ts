import { TemplateVars } from './types';
import { LIBRARY_VERSION } from '../lib/version';

export function packageJsonTemplate(vars: TemplateVars, monorepo: boolean): string {
    // Standalone plugins depend on the core released with this scaffolder (all @qodalis packages share one version)
    const coreVersion = monorepo ? 'workspace:*' : `^${LIBRARY_VERSION}`;
    // Monorepo plugins are published from dist/<name> (package.json copied next to the build);
    // standalone ones from their own folder, with the build in dist/
    const out = monorepo ? '.' : './dist';
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
            umd: `${out}/umd/index.global.js`,
            unpkg: `${out}/umd/index.global.js`,
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
            files: monorepo ? undefined : ['dist'],
            sideEffects: false,
            main: `${out}/public-api.js`,
            module: `${out}/public-api.mjs`,
            types: `${out}/public-api.d.ts`,
            exports: {
                '.': {
                    types: `${out}/public-api.d.ts`,
                    import: `${out}/public-api.mjs`,
                    require: `${out}/public-api.js`,
                },
            },
        },
        null,
        2,
    );
}

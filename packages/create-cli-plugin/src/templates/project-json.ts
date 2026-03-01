import { TemplateVars } from './types';

export function projectJsonTemplate(vars: TemplateVars): string {
    return JSON.stringify(
        {
            name: vars.name,
            $schema: '../../../node_modules/nx/schemas/project-schema.json',
            sourceRoot: `packages/plugins/${vars.name}/src`,
            targets: {
                build: {
                    executor: 'nx:run-commands',
                    options: {
                        commands: [
                            'tsup',
                            `cp package.json ../../../dist/${vars.name}/package.json`,
                        ],
                        cwd: `packages/plugins/${vars.name}`,
                        parallel: false,
                    },
                    inputs: ['production', 'sharedGlobals'],
                    outputs: [`{workspaceRoot}/dist/${vars.name}`],
                },
                test: {
                    executor: '@angular-devkit/build-angular:karma',
                    options: {
                        tsConfig: `packages/plugins/${vars.name}/tsconfig.spec.json`,
                        polyfills: ['zone.js', 'zone.js/testing'],
                    },
                },
            },
        },
        null,
        2,
    );
}

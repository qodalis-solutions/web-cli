import * as fs from 'fs';
import * as path from 'path';
import { TemplateVars } from './templates/types';
import { packageJsonTemplate } from './templates/package-json';
import { tsupConfigStandaloneTemplate } from './templates/tsup-config-standalone';
import { tsupConfigMonorepoTemplate } from './templates/tsup-config-monorepo';
import { tsconfigStandaloneTemplate } from './templates/tsconfig-standalone';
import { tsconfigMonorepoTemplate } from './templates/tsconfig-monorepo';
import { processorTemplate } from './templates/processor';
import { publicApiTemplate } from './templates/public-api';
import { cliEntrypointTemplate } from './templates/cli-entrypoint';
import { versionTemplate } from './templates/version';
import { testTemplate } from './templates/test';
import { gitignoreTemplate } from './templates/gitignore';
import { readmeTemplate } from './templates/readme';
import { projectJsonTemplate } from './templates/project-json';
import { tsconfigSpecTemplate } from './templates/tsconfig-spec';
import { MonorepoInfo } from './detect-monorepo';
import { PluginAnswers } from './prompts';

function writeFile(filePath: string, content: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`  created ${path.relative(process.cwd(), filePath)}`);
}

export function scaffoldPlugin(answers: PluginAnswers, monorepo: MonorepoInfo | null): string {
    const vars: TemplateVars = {
        name: answers.name,
        processorName: answers.processorName,
        processorFileName: `cli-${answers.name}-command-processor`,
        description: answers.description,
        version: '0.0.1',
    };

    const isMonorepo = monorepo !== null;
    const projectDir = isMonorepo
        ? path.join(monorepo!.pluginsDir, vars.name)
        : path.join(process.cwd(), `qodalis-cli-${vars.name}`);

    if (fs.existsSync(projectDir)) {
        throw new Error(`Directory already exists: ${projectDir}`);
    }

    console.log(`\nScaffolding plugin in ${projectDir}...\n`);

    // package.json
    writeFile(path.join(projectDir, 'package.json'), packageJsonTemplate(vars, isMonorepo));

    // tsup.config.ts
    const tsupConfig = isMonorepo
        ? tsupConfigMonorepoTemplate(vars)
        : tsupConfigStandaloneTemplate(vars);
    writeFile(path.join(projectDir, 'tsup.config.ts'), tsupConfig);

    // tsconfig.json
    const tsconfig = isMonorepo
        ? tsconfigMonorepoTemplate(vars)
        : tsconfigStandaloneTemplate(vars);
    writeFile(path.join(projectDir, 'tsconfig.json'), tsconfig);

    // README.md
    writeFile(path.join(projectDir, 'README.md'), readmeTemplate(vars));

    // src/public-api.ts
    writeFile(path.join(projectDir, 'src', 'public-api.ts'), publicApiTemplate(vars));

    // src/cli-entrypoint.ts
    writeFile(path.join(projectDir, 'src', 'cli-entrypoint.ts'), cliEntrypointTemplate(vars));

    // src/lib/version.ts
    writeFile(path.join(projectDir, 'src', 'lib', 'version.ts'), versionTemplate(vars));

    // src/lib/index.ts (barrel re-export)
    writeFile(
        path.join(projectDir, 'src', 'lib', 'index.ts'),
        `export * from './processors/${vars.processorFileName}';\nexport * from './version';\n`,
    );

    // src/lib/processors/<name>.ts
    writeFile(
        path.join(projectDir, 'src', 'lib', 'processors', `${vars.processorFileName}.ts`),
        processorTemplate(vars),
    );

    // src/tests/index.spec.ts
    writeFile(path.join(projectDir, 'src', 'tests', 'index.spec.ts'), testTemplate(vars));

    // Monorepo-specific files
    if (isMonorepo) {
        writeFile(path.join(projectDir, 'project.json'), projectJsonTemplate(vars));
        writeFile(path.join(projectDir, 'tsconfig.spec.json'), tsconfigSpecTemplate(vars));
        updateTsconfigPaths(monorepo!.root, vars.name);
    }

    // Standalone-specific files
    if (!isMonorepo) {
        writeFile(path.join(projectDir, '.gitignore'), gitignoreTemplate());
    }

    return projectDir;
}

function updateTsconfigPaths(monorepoRoot: string, name: string): void {
    const tsconfigPath = path.join(monorepoRoot, 'tsconfig.base.json');
    const content = fs.readFileSync(tsconfigPath, 'utf-8');
    const tsconfig = JSON.parse(content);

    const alias = `@qodalis/cli-${name}`;
    if (!tsconfig.compilerOptions.paths[alias]) {
        tsconfig.compilerOptions.paths[alias] = [`dist/${name}`];
        fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n', 'utf-8');
        console.log(`  updated tsconfig.base.json with path alias: ${alias}`);
    }
}

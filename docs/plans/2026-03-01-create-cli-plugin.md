# @qodalis/create-cli-plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a standalone npm CLI tool (`@qodalis/create-cli-plugin`) that scaffolds Qodalis CLI plugins, with dual-mode support for standalone projects and monorepo integration.

**Architecture:** A TypeScript CLI bundled with tsup into a single CJS file with a `#!/usr/bin/env node` shebang. Uses commander.js for CLI parsing and @inquirer/prompts for interactive input. Templates are embedded as template literal functions. Detects monorepo context by checking for `pnpm-workspace.yaml` + `packages/plugins/` at CWD ancestors.

**Tech Stack:** TypeScript, tsup, commander.js, @inquirer/prompts

---

### Task 1: Scaffold the package directory and package.json

**Files:**
- Create: `packages/create-cli-plugin/package.json`
- Create: `packages/create-cli-plugin/tsconfig.json`
- Create: `packages/create-cli-plugin/tsup.config.ts`
- Create: `packages/create-cli-plugin/project.json`

**Step 1: Create `packages/create-cli-plugin/package.json`**

```json
{
    "name": "@qodalis/create-cli-plugin",
    "version": "1.0.0",
    "description": "CLI tool to scaffold Qodalis CLI plugins",
    "author": "Nicolae Lupei, Qodalis Solutions",
    "license": "MIT",
    "repository": {
        "type": "git",
        "url": "https://github.com/qodalis-solutions/web-cli"
    },
    "homepage": "https://qodalis.com",
    "keywords": [
        "cli",
        "qodalis",
        "terminal",
        "scaffold",
        "plugin",
        "create"
    ],
    "bin": {
        "create-cli-plugin": "./index.js"
    },
    "main": "./index.js",
    "types": "./index.d.ts",
    "files": [
        "index.js",
        "index.d.ts"
    ],
    "dependencies": {
        "@inquirer/prompts": "^7.0.0",
        "commander": "^13.0.0"
    }
}
```

**Step 2: Create `packages/create-cli-plugin/tsconfig.json`**

```json
{
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
        "outDir": "../../dist/create-cli-plugin",
        "declaration": true,
        "declarationMap": true,
        "rootDir": "src",
        "module": "CommonJS",
        "moduleResolution": "node"
    },
    "include": ["src/**/*"],
    "exclude": ["**/*.spec.ts"]
}
```

**Step 3: Create `packages/create-cli-plugin/tsup.config.ts`**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs'],
    dts: true,
    clean: true,
    splitting: false,
    treeshake: true,
    banner: {
        js: '#!/usr/bin/env node',
    },
    outDir: '../../dist/create-cli-plugin',
    noExternal: [/(.*)/],
    platform: 'node',
    target: 'node18',
});
```

Note: `noExternal: [/(.*)/]` bundles all dependencies (commander, @inquirer/prompts) into a single file so the published package has zero runtime dependencies. The `banner` adds the shebang for direct execution.

**Step 4: Create `packages/create-cli-plugin/project.json`**

```json
{
    "name": "create-cli-plugin",
    "$schema": "../../node_modules/nx/schemas/project-schema.json",
    "sourceRoot": "packages/create-cli-plugin/src",
    "targets": {
        "build": {
            "executor": "nx:run-commands",
            "options": {
                "commands": [
                    "tsup",
                    "cp package.json ../../dist/create-cli-plugin/package.json",
                    "chmod +x ../../dist/create-cli-plugin/index.js"
                ],
                "cwd": "packages/create-cli-plugin",
                "parallel": false
            },
            "inputs": [
                "production",
                "sharedGlobals"
            ],
            "outputs": [
                "{workspaceRoot}/dist/create-cli-plugin"
            ]
        }
    }
}
```

**Step 5: Install dependencies**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm install`

**Step 6: Commit**

```bash
git add packages/create-cli-plugin/package.json packages/create-cli-plugin/tsconfig.json packages/create-cli-plugin/tsup.config.ts packages/create-cli-plugin/project.json
git commit -m "feat(create-cli-plugin): scaffold package with build config"
```

---

### Task 2: Create the template functions

All templates are TypeScript functions that accept a vars object and return the file content as a string. Each lives in its own file under `src/templates/`.

**Files:**
- Create: `packages/create-cli-plugin/src/templates/types.ts`
- Create: `packages/create-cli-plugin/src/templates/package-json.ts`
- Create: `packages/create-cli-plugin/src/templates/tsup-config-standalone.ts`
- Create: `packages/create-cli-plugin/src/templates/tsup-config-monorepo.ts`
- Create: `packages/create-cli-plugin/src/templates/tsconfig-standalone.ts`
- Create: `packages/create-cli-plugin/src/templates/tsconfig-monorepo.ts`
- Create: `packages/create-cli-plugin/src/templates/processor.ts`
- Create: `packages/create-cli-plugin/src/templates/module.ts`
- Create: `packages/create-cli-plugin/src/templates/public-api.ts`
- Create: `packages/create-cli-plugin/src/templates/cli-entrypoint.ts`
- Create: `packages/create-cli-plugin/src/templates/version.ts`
- Create: `packages/create-cli-plugin/src/templates/test.ts`
- Create: `packages/create-cli-plugin/src/templates/gitignore.ts`
- Create: `packages/create-cli-plugin/src/templates/readme.ts`
- Create: `packages/create-cli-plugin/src/templates/project-json.ts`
- Create: `packages/create-cli-plugin/src/templates/tsconfig-spec.ts`
- Create: `packages/create-cli-plugin/src/templates/index.ts`

**Step 1: Create the shared types**

File: `packages/create-cli-plugin/src/templates/types.ts`

```typescript
export interface TemplateVars {
    name: string;
    processorName: string;
    processorFileName: string;
    description: string;
    version: string;
}
```

**Step 2: Create package-json template**

File: `packages/create-cli-plugin/src/templates/package-json.ts`

Two variants: standalone uses a real npm version for `@qodalis/cli-core`; monorepo uses `workspace:*`.

```typescript
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
```

**Step 3: Create tsup config templates (two variants)**

File: `packages/create-cli-plugin/src/templates/tsup-config-standalone.ts`

```typescript
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
```

File: `packages/create-cli-plugin/src/templates/tsup-config-monorepo.ts`

```typescript
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
```

**Step 4: Create tsconfig templates (two variants)**

File: `packages/create-cli-plugin/src/templates/tsconfig-standalone.ts`

```typescript
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
```

File: `packages/create-cli-plugin/src/templates/tsconfig-monorepo.ts`

```typescript
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
```

**Step 5: Create processor template**

File: `packages/create-cli-plugin/src/templates/processor.ts`

```typescript
import { TemplateVars } from './types';

export function processorTemplate(vars: TemplateVars): string {
    return `import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

export class Cli${vars.processorName}CommandProcessor implements ICliCommandProcessor {
    command = '${vars.name}';

    description = '${vars.description}';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln(this.description!);
    }
}
`;
}
```

Note: No `@Injectable()` decorator — standalone plugins don't use Angular DI.

**Step 6: Create module template**

File: `packages/create-cli-plugin/src/templates/module.ts`

```typescript
import { TemplateVars } from './types';

export function moduleTemplate(vars: TemplateVars): string {
    return `import { ICliModule } from '@qodalis/cli-core';
import { Cli${vars.processorName}CommandProcessor } from './processors/${vars.processorFileName}';
import { API_VERSION } from './version';

export const ${vars.name}Module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-${vars.name}',
    processors: [new Cli${vars.processorName}CommandProcessor()],
};
`;
}
```

**Step 7: Create public-api template**

File: `packages/create-cli-plugin/src/templates/public-api.ts`

```typescript
import { TemplateVars } from './types';

export function publicApiTemplate(vars: TemplateVars): string {
    return `/*
 * Public API Surface of ${vars.name}
 */

export * from './lib/processors/${vars.processorFileName}';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { Cli${vars.processorName}CommandProcessor } from './lib/processors/${vars.processorFileName}';
import { API_VERSION } from './lib/version';

export const ${vars.name}Module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-${vars.name}',
    processors: [new Cli${vars.processorName}CommandProcessor()],
};
`;
}
```

**Step 8: Create cli-entrypoint template**

File: `packages/create-cli-plugin/src/templates/cli-entrypoint.ts`

```typescript
import { TemplateVars } from './types';

export function cliEntrypointTemplate(vars: TemplateVars): string {
    return `import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { Cli${vars.processorName}CommandProcessor } from './lib/processors/${vars.processorFileName}';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-${vars.name}',
    processors: [new Cli${vars.processorName}CommandProcessor()],
};

bootCliModule(module);
`;
}
```

**Step 9: Create version template**

File: `packages/create-cli-plugin/src/templates/version.ts`

```typescript
import { TemplateVars } from './types';

export function versionTemplate(vars: TemplateVars): string {
    const majorVersion = vars.version.split('.')[0];
    return `// Automatically generated during build
export const LIBRARY_VERSION = '${vars.version}';
export const API_VERSION = ${majorVersion};
`;
}
```

**Step 10: Create test template**

File: `packages/create-cli-plugin/src/templates/test.ts`

```typescript
import { TemplateVars } from './types';

export function testTemplate(vars: TemplateVars): string {
    return `import { Cli${vars.processorName}CommandProcessor } from '../lib/processors/${vars.processorFileName}';

describe('Cli${vars.processorName}Module', () => {
    it('processor instance should be created', () => {
        const processor = new Cli${vars.processorName}CommandProcessor();
        expect(processor).toBeDefined();
    });

    it('should have correct command name', () => {
        const processor = new Cli${vars.processorName}CommandProcessor();
        expect(processor.command).toBe('${vars.name}');
    });
});
`;
}
```

**Step 11: Create gitignore template**

File: `packages/create-cli-plugin/src/templates/gitignore.ts`

```typescript
export function gitignoreTemplate(): string {
    return `node_modules/
dist/
*.js
*.mjs
*.d.ts
*.d.mts
*.map
!tsup.config.ts
`;
}
```

**Step 12: Create readme template**

File: `packages/create-cli-plugin/src/templates/readme.ts`

```typescript
import { TemplateVars } from './types';

export function readmeTemplate(vars: TemplateVars): string {
    return `# @qodalis/cli-${vars.name}

${vars.description}

## Installation

\`\`\`bash
packages add @qodalis/cli-${vars.name}
\`\`\`

## Usage

\`\`\`bash
${vars.name}
\`\`\`

## Development

\`\`\`bash
npm install
npm run build
\`\`\`

## Build

Builds two outputs:
- **Module** (CJS + ESM): \`dist/public-api.js\` and \`dist/public-api.mjs\`
- **IIFE bundle**: \`dist/umd/index.js\` (for browser runtime loading)
`;
}
```

**Step 13: Create project.json template (monorepo only)**

File: `packages/create-cli-plugin/src/templates/project-json.ts`

```typescript
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
```

**Step 14: Create tsconfig.spec.json template (monorepo only)**

File: `packages/create-cli-plugin/src/templates/tsconfig-spec.ts`

```typescript
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
```

**Step 15: Create barrel export**

File: `packages/create-cli-plugin/src/templates/index.ts`

```typescript
export { TemplateVars } from './types';
export { packageJsonTemplate } from './package-json';
export { tsupConfigStandaloneTemplate } from './tsup-config-standalone';
export { tsupConfigMonorepoTemplate } from './tsup-config-monorepo';
export { tsconfigStandaloneTemplate } from './tsconfig-standalone';
export { tsconfigMonorepoTemplate } from './tsconfig-monorepo';
export { processorTemplate } from './processor';
export { moduleTemplate } from './module';
export { publicApiTemplate } from './public-api';
export { cliEntrypointTemplate } from './cli-entrypoint';
export { versionTemplate } from './version';
export { testTemplate } from './test';
export { gitignoreTemplate } from './gitignore';
export { readmeTemplate } from './readme';
export { projectJsonTemplate } from './project-json';
export { tsconfigSpecTemplate } from './tsconfig-spec';
```

**Step 16: Commit**

```bash
git add packages/create-cli-plugin/src/templates/
git commit -m "feat(create-cli-plugin): add all template functions"
```

---

### Task 3: Create the monorepo detection utility

**Files:**
- Create: `packages/create-cli-plugin/src/detect-monorepo.ts`

**Step 1: Create the detection function**

File: `packages/create-cli-plugin/src/detect-monorepo.ts`

Walks up directories from CWD looking for `pnpm-workspace.yaml` that contains `packages/plugins/*`. Returns the monorepo root path or `null`.

```typescript
import * as fs from 'fs';
import * as path from 'path';

export interface MonorepoInfo {
    root: string;
    pluginsDir: string;
}

export function detectMonorepo(cwd: string): MonorepoInfo | null {
    let dir = cwd;
    while (true) {
        const workspaceFile = path.join(dir, 'pnpm-workspace.yaml');
        const pluginsDir = path.join(dir, 'packages', 'plugins');
        if (fs.existsSync(workspaceFile) && fs.existsSync(pluginsDir)) {
            const content = fs.readFileSync(workspaceFile, 'utf-8');
            if (content.includes('packages/plugins')) {
                return { root: dir, pluginsDir };
            }
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return null;
}
```

**Step 2: Commit**

```bash
git add packages/create-cli-plugin/src/detect-monorepo.ts
git commit -m "feat(create-cli-plugin): add monorepo detection"
```

---

### Task 4: Create the interactive prompts module

**Files:**
- Create: `packages/create-cli-plugin/src/prompts.ts`

**Step 1: Create the prompts**

File: `packages/create-cli-plugin/src/prompts.ts`

```typescript
import { input } from '@inquirer/prompts';

function toPascalCase(str: string): string {
    return str
        .split(/[-_\s]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

export interface PluginAnswers {
    name: string;
    description: string;
    processorName: string;
}

export async function promptForPluginInfo(): Promise<PluginAnswers> {
    const name = await input({
        message: 'Plugin name (lowercase, e.g. "mylib"):',
        validate: (value) => {
            if (!value) return 'Plugin name is required';
            if (value !== value.toLowerCase()) return 'Must be lowercase';
            if (/\s/.test(value)) return 'Must not contain spaces';
            if (value.startsWith('cli-')) return 'Do not prefix with "cli-" (added automatically)';
            if (!/^[a-z][a-z0-9-]*$/.test(value)) return 'Must start with a letter, only lowercase letters, numbers, and hyphens';
            return true;
        },
    });

    const description = await input({
        message: 'Description:',
        default: `CLI extension for ${name}`,
    });

    const suggestedName = toPascalCase(name);
    const processorName = await input({
        message: `Processor class name (Cli___CommandProcessor):`,
        default: suggestedName,
    });

    return { name, description, processorName };
}
```

**Step 2: Commit**

```bash
git add packages/create-cli-plugin/src/prompts.ts
git commit -m "feat(create-cli-plugin): add interactive prompts"
```

---

### Task 5: Create the scaffolding logic

**Files:**
- Create: `packages/create-cli-plugin/src/scaffold.ts`

**Step 1: Create the scaffold module**

File: `packages/create-cli-plugin/src/scaffold.ts`

This is the core logic. It takes the answers + mode and creates all files.

```typescript
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
        ? path.join(monorepo.pluginsDir, vars.name)
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
        updateTsconfigPaths(monorepo.root, vars.name);
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
```

**Step 2: Commit**

```bash
git add packages/create-cli-plugin/src/scaffold.ts
git commit -m "feat(create-cli-plugin): add scaffolding logic with dual-mode support"
```

---

### Task 6: Create the CLI entry point

**Files:**
- Create: `packages/create-cli-plugin/src/index.ts`

**Step 1: Create the main entry point**

File: `packages/create-cli-plugin/src/index.ts`

```typescript
import { Command } from 'commander';
import { execSync } from 'child_process';
import { detectMonorepo } from './detect-monorepo';
import { promptForPluginInfo } from './prompts';
import { scaffoldPlugin } from './scaffold';

const program = new Command();

program
    .name('create-cli-plugin')
    .description('Scaffold a new Qodalis CLI plugin')
    .version('1.0.0')
    .action(async () => {
        try {
            const cwd = process.cwd();
            const monorepo = detectMonorepo(cwd);

            if (monorepo) {
                console.log(`Detected web-cli monorepo at: ${monorepo.root}`);
                console.log('Plugin will be created inside the monorepo.\n');
            } else {
                console.log('Creating a standalone plugin project.\n');
            }

            const answers = await promptForPluginInfo();
            const projectDir = scaffoldPlugin(answers, monorepo);

            console.log('\nDone!\n');

            if (monorepo) {
                console.log('Next steps:');
                console.log(`  1. cd ${projectDir}`);
                console.log(`  2. Implement your command in src/lib/processors/`);
                console.log(`  3. pnpm nx build ${answers.name}`);
                console.log(`  4. pnpm nx test ${answers.name}`);
            } else {
                console.log('Installing dependencies...\n');
                const pm = detectPackageManager();
                execSync(`${pm} install`, { cwd: projectDir, stdio: 'inherit' });

                console.log('\nNext steps:');
                console.log(`  1. cd qodalis-cli-${answers.name}`);
                console.log(`  2. Implement your command in src/lib/processors/`);
                console.log(`  3. ${pm === 'npm' ? 'npx' : pm} tsup`);
                console.log(`  4. npm publish --access public`);
            }
        } catch (error) {
            if (error instanceof Error) {
                console.error(`\nError: ${error.message}`);
            }
            process.exit(1);
        }
    });

function detectPackageManager(): string {
    try {
        execSync('pnpm --version', { stdio: 'ignore' });
        return 'pnpm';
    } catch {
        return 'npm';
    }
}

program.parse();
```

**Step 2: Commit**

```bash
git add packages/create-cli-plugin/src/index.ts
git commit -m "feat(create-cli-plugin): add CLI entry point with commander"
```

---

### Task 7: Build and test locally

**Step 1: Build the package**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm nx build create-cli-plugin`
Expected: Build succeeds, `dist/create-cli-plugin/index.js` exists with shebang.

**Step 2: Verify the binary is executable**

Run: `node dist/create-cli-plugin/index.js --version`
Expected: `1.0.0`

**Step 3: Verify help output**

Run: `node dist/create-cli-plugin/index.js --help`
Expected: Shows name, description, version option, help option.

**Step 4: Test standalone mode**

Run in a temp directory:
```bash
mkdir -p /tmp/test-create-plugin && cd /tmp/test-create-plugin
node /Users/nicolaelupei/Documents/Personal/web-cli/dist/create-cli-plugin/index.js
```
Enter: name=`testplugin`, description=`A test plugin`, processorName=`TestPlugin`
Expected: Creates `/tmp/test-create-plugin/qodalis-cli-testplugin/` with all files.
Verify: `cat /tmp/test-create-plugin/qodalis-cli-testplugin/package.json` shows `@qodalis/cli-core` as real npm dep (not `workspace:*`).
Cleanup: `rm -rf /tmp/test-create-plugin`

**Step 5: Test monorepo mode**

Run from the web-cli root:
```bash
cd /Users/nicolaelupei/Documents/Personal/web-cli
node dist/create-cli-plugin/index.js
```
Enter: name=`testplugin`, description=`A test plugin`, processorName=`TestPlugin`
Expected: Creates `packages/plugins/testplugin/` with `workspace:*` dep, monorepo tsup config, project.json, and updates tsconfig.base.json paths.
Cleanup: `rm -rf packages/plugins/testplugin` and revert tsconfig.base.json change.

**Step 6: Commit**

```bash
git commit --allow-empty -m "chore(create-cli-plugin): verified build and dual-mode scaffolding"
```

---

### Task 8: Update deploy workflow and workspace config

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Step 1: Verify pnpm-workspace.yaml already covers `packages/*`**

The existing `pnpm-workspace.yaml` has `"packages/*"` which already includes `packages/create-cli-plugin`. No change needed.

**Step 2: Update deploy.yml to include create-cli-plugin**

The deploy workflow publishes everything in `dist/` that isn't in the EXCLUDED list. Since the build step already runs `nx run-many -t build` which will build `create-cli-plugin`, and the publish step iterates over `dist/` dirs, the `create-cli-plugin` dist output will be picked up automatically.

However, the `bin` field requires the output file to be executable. Add a step after build:

In `.github/workflows/deploy.yml`, after the "Build all projects" step, add:

```yaml
      - name: Make create-cli-plugin executable
        run: chmod +x dist/create-cli-plugin/index.js
```

Note: This is already handled by the `chmod +x` in `project.json` build commands, so this may be redundant. But it's a safety net for CI.

**Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: ensure create-cli-plugin binary is executable in deploy"
```

---

### Task 9: Final cleanup and documentation

**Step 1: Add a script to root package.json for convenience**

In `web-cli/package.json`, add to scripts:
```json
"create-plugin": "nx build create-cli-plugin && node dist/create-cli-plugin/index.js"
```

This lets monorepo developers run `pnpm run create-plugin` as a shortcut.

**Step 2: Remove or deprecate the old tool**

Add a notice to the top of `tools/create-library.js`:

```javascript
// DEPRECATED: Use @qodalis/create-cli-plugin instead.
// Run: pnpm run create-plugin
// Or: npx @qodalis/create-cli-plugin
```

Do NOT delete the file yet — keep it for reference until the new tool is battle-tested.

**Step 3: Commit**

```bash
git add package.json tools/create-library.js
git commit -m "feat(create-cli-plugin): add create-plugin script, deprecate old tool"
```

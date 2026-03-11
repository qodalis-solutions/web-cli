# CLI Framework Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract framework-agnostic CLI engine into `@qodalis/cli`, rename `projects/cli/` to `projects/angular-cli/`, create new `projects/cli/` for the framework-agnostic package.

**Architecture:** Three-layer: `@qodalis/cli-core` (interfaces) → `@qodalis/cli` (engine + pure processors) → `@qodalis/angular-cli` (Angular components + DI bridge). No breaking changes to angular-cli's public API.

**Tech Stack:** Angular 16, ng-packagr, TypeScript, xterm.js, RxJS (temporarily in cli, removed later)

**Design doc:** `docs/plans/2026-02-23-cli-framework-split-design.md`

---

### Task 1: Rename `projects/cli/` to `projects/angular-cli/`

Physical rename of the folder and all references. This is the biggest mechanical change.

**Files:**
- Rename: `projects/cli/` → `projects/angular-cli/`
- Modify: `angular.json` (project key + all paths)
- Modify: `tsconfig.json:7` (path alias dest)
- Modify: `scripts/build-all.js:31` (mainFolders array)
- Modify: `package.json:12-15` (build/watch scripts)

**Step 1: Rename the directory**

```bash
cd /Users/nicolaelupei/Documents/Personal/angular-web-cli
git mv projects/cli projects/angular-cli
```

**Step 2: Update angular.json**

Replace all occurrences of the `"cli"` project:
- Rename the project key from `"cli"` to `"angular-cli"`
- Update all paths: `projects/cli` → `projects/angular-cli`
- Keep the `"cli"` key under root-level `"cli": { "analytics": ... }` unchanged (that's Angular CLI config, not a project)

Specifically change lines 11-48:
```json
"angular-cli": {
  "projectType": "library",
  "root": "projects/angular-cli",
  "sourceRoot": "projects/angular-cli/src",
  "prefix": "lib",
  "architect": {
    "build": {
      "builder": "@angular-devkit/build-angular:ng-packagr",
      "options": {
        "project": "projects/angular-cli/ng-package.json"
      },
      "configurations": {
        "production": {
          "tsConfig": "projects/angular-cli/tsconfig.lib.prod.json"
        },
        "development": {
          "tsConfig": "projects/angular-cli/tsconfig.lib.json"
        }
      },
      "defaultConfiguration": "production"
    },
    "test": {
      "builder": "@angular-devkit/build-angular:karma",
      "options": {
        "tsConfig": "projects/angular-cli/tsconfig.spec.json",
        "polyfills": ["zone.js", "zone.js/testing"]
      }
    },
    "lint": {
      "builder": "@angular-eslint/builder:lint",
      "options": {
        "lintFilePatterns": [
          "projects/angular-cli/**/*.ts",
          "projects/angular-cli/**/*.html"
        ]
      }
    }
  }
}
```

Also update the demo `styles` path (line 76):
```json
"projects/angular-cli/src/assets/styles.sass"
```

**Step 3: Update tsconfig.json**

Change the `@qodalis/angular-cli` path alias (line 7):
```json
"@qodalis/angular-cli": ["dist/angular-cli"]
```

**Step 4: Update ng-package.json dest**

In `projects/angular-cli/ng-package.json`, change:
```json
"dest": "../../dist/angular-cli"
```

**Step 5: Update build-all.js**

In `scripts/build-all.js` line 31, change:
```javascript
const mainFolders = ["core", "angular-cli"];
```

**Step 6: Update root package.json scripts**

```json
"build:styles": "sass projects/angular-cli/src/assets/styles.sass projects/angular-cli/src/assets/styles.css --no-source-map",
"build:styles:watch": "sass --watch projects/angular-cli/src/assets/styles.sass projects/angular-cli/src/assets/styles.css --no-source-map",
"build cli": "npm run build:styles && ng build angular-cli",
"watch cli": "npm run build:styles:watch & ng build angular-cli --watch --configuration development",
```

**Step 7: Verify build works**

```bash
npm run "build core" && npm run "build cli"
```

Expected: Both build successfully with output in `dist/core/` and `dist/angular-cli/`.

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor: rename projects/cli to projects/angular-cli

Renames the folder on disk to match the npm package name and free
up 'cli' for the new framework-agnostic package."
```

---

### Task 2: Scaffold new `projects/cli/` for `@qodalis/cli`

Create the project structure for the new framework-agnostic CLI package.

**Files:**
- Create: `projects/cli/package.json`
- Create: `projects/cli/ng-package.json`
- Create: `projects/cli/tsconfig.lib.json`
- Create: `projects/cli/tsconfig.lib.prod.json`
- Create: `projects/cli/tsconfig.spec.json`
- Create: `projects/cli/src/public-api.ts`
- Create: `projects/cli/src/lib/index.ts`
- Modify: `angular.json` (add new "cli" project)
- Modify: `tsconfig.json` (add `@qodalis/cli` path alias)
- Modify: `scripts/build-all.js` (update build order)

**Step 1: Create package.json**

```json
{
  "name": "@qodalis/cli",
  "version": "0.1.0",
  "description": "Framework-agnostic CLI engine for @qodalis terminal applications.",
  "author": "Nicolae Lupei, Qodalis Solutions",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/qodalis-solutions/angular-web-cli"
  },
  "homepage": "https://qodalis.com",
  "keywords": ["cli", "qodalis", "terminal", "command-line"],
  "peerDependencies": {
    "@angular/common": "^16.2.0",
    "@angular/core": "^16.2.0"
  },
  "dependencies": {
    "tslib": "^2.3.0",
    "@qodalis/cli-core": "^0.0.16",
    "@xterm/xterm": "^5.5.0"
  },
  "sideEffects": false
}
```

Note: Angular peer deps are required by ng-packagr build tool. The code itself will NOT import from `@angular/*`. This will be removed when we switch to a plain TS build.

**Step 2: Create ng-package.json**

```json
{
  "$schema": "../../node_modules/ng-packagr/ng-package.schema.json",
  "dest": "../../dist/cli",
  "lib": {
    "entryFile": "src/public-api.ts"
  },
  "allowedNonPeerDependencies": [
    "@qodalis/cli-core",
    "@xterm/xterm"
  ]
}
```

**Step 3: Create tsconfig.lib.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "../../out-tsc/lib",
    "declaration": true,
    "declarationMap": true,
    "inlineSources": true,
    "types": []
  },
  "exclude": ["**/*.spec.ts"]
}
```

**Step 4: Create tsconfig.lib.prod.json**

```json
{
  "extends": "./tsconfig.lib.json",
  "compilerOptions": {
    "declarationMap": false
  },
  "angularCompilerOptions": {
    "compilationMode": "partial"
  }
}
```

**Step 5: Create tsconfig.spec.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "../../out-tsc/spec",
    "types": ["jasmine"]
  },
  "include": ["**/*.spec.ts", "**/*.d.ts"]
}
```

**Step 6: Create initial public-api.ts**

```typescript
/*
 * Public API Surface of @qodalis/cli
 */

export * from './lib/index';
```

**Step 7: Create initial lib/index.ts**

```typescript
// @qodalis/cli — Framework-agnostic CLI engine
// Modules will be added as code is moved from @qodalis/angular-cli
```

**Step 8: Add project to angular.json**

Add a new `"cli"` project entry (insert after the `"angular-cli"` entry):

```json
"cli": {
  "projectType": "library",
  "root": "projects/cli",
  "sourceRoot": "projects/cli/src",
  "prefix": "lib",
  "architect": {
    "build": {
      "builder": "@angular-devkit/build-angular:ng-packagr",
      "options": {
        "project": "projects/cli/ng-package.json"
      },
      "configurations": {
        "production": {
          "tsConfig": "projects/cli/tsconfig.lib.prod.json"
        },
        "development": {
          "tsConfig": "projects/cli/tsconfig.lib.json"
        }
      },
      "defaultConfiguration": "production"
    },
    "test": {
      "builder": "@angular-devkit/build-angular:karma",
      "options": {
        "tsConfig": "projects/cli/tsconfig.spec.json",
        "polyfills": ["zone.js", "zone.js/testing"]
      }
    }
  }
}
```

**Step 9: Add path alias to tsconfig.json**

Add after the `@qodalis/cli-core` line:
```json
"@qodalis/cli": ["dist/cli"],
```

**Step 10: Update build-all.js**

Change mainFolders to include the new project:
```javascript
const mainFolders = ["core", "cli", "angular-cli"];
```

This ensures build order: `core` → `cli` → `angular-cli` → plugins → demo.

**Step 11: Update angular-cli's package.json dependency**

In `projects/angular-cli/package.json`, add `@qodalis/cli` to dependencies:
```json
"dependencies": {
    "tslib": "^2.3.0",
    "@qodalis/cli-core": "^0.0.16",
    "@qodalis/cli": "^0.1.0",
    "@xterm/xterm": "^5.5.0",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/addon-web-links": "^0.11.0",
    "@xterm/addon-webgl": "^0.18.0",
    "@xterm/addon-unicode11": "^0.8.0"
}
```

Also add to ng-package.json `allowedNonPeerDependencies`:
```json
"allowedNonPeerDependencies": [
    "@qodalis/cli-core",
    "@qodalis/cli",
    "@xterm/xterm",
    "@xterm/addon-fit",
    "@xterm/addon-web-links",
    "@xterm/addon-webgl",
    "@xterm/addon-unicode11"
]
```

**Step 12: Verify build works**

```bash
ng build core && ng build cli && ng build angular-cli
```

Expected: All three build. `dist/cli/` contains a minimal (nearly empty) package.

**Step 13: Commit**

```bash
git add -A
git commit -m "feat: scaffold @qodalis/cli project

Creates the new framework-agnostic CLI package shell at projects/cli/.
Build order is now: core → cli → angular-cli → plugins → demo."
```

---

### Task 3: Move parsers and pure utilities to `@qodalis/cli`

Move the framework-agnostic utility code first since it has no dependencies.

**Files:**
- Create: `projects/cli/src/lib/parsers/command-parser.ts` (copy from angular-cli)
- Create: `projects/cli/src/lib/parsers/args-parser.ts` (copy from angular-cli)
- Create: `projects/cli/src/lib/parsers/index.ts`
- Create: `projects/cli/src/lib/utils/arrays.ts` (copy from angular-cli)
- Create: `projects/cli/src/lib/utils/index.ts`
- Create: `projects/cli/src/lib/errors/index.ts` (copy ProcessExitedError)
- Modify: `projects/cli/src/lib/index.ts` (export new modules)
- Modify: `projects/angular-cli/src/lib/utils/command-parser.ts` → re-export from `@qodalis/cli`
- Modify: `projects/angular-cli/src/lib/utils/args-parser.ts` → re-export from `@qodalis/cli`
- Modify: `projects/angular-cli/src/lib/utils/arrays.ts` → re-export from `@qodalis/cli`
- Modify: `projects/angular-cli/src/lib/cli/context/errors/index.ts` → re-export from `@qodalis/cli`

**Step 1: Write test for CommandParser**

Create `projects/cli/src/tests/command-parser.spec.ts`:
```typescript
import { CommandParser } from '../lib/parsers/command-parser';

describe('CommandParser', () => {
    let parser: CommandParser;

    beforeEach(() => {
        parser = new CommandParser();
    });

    it('should parse a simple command', () => {
        const result = parser.parse('echo hello');
        expect(result.commandName).toBe('echo hello');
        expect(result.args.length).toBe(0);
    });

    it('should parse command with flag arguments', () => {
        const result = parser.parse('build --verbose --output=dist');
        expect(result.commandName).toBe('build');
        expect(result.args).toContain(jasmine.objectContaining({ name: 'verbose', value: true }));
        expect(result.args).toContain(jasmine.objectContaining({ name: 'output', value: 'dist' }));
    });

    it('should parse numeric values', () => {
        const result = parser.parse('test --count=5');
        expect(result.args[0].value).toBe(5);
    });

    it('should parse boolean string values', () => {
        const result = parser.parse('test --flag=true');
        expect(result.args[0].value).toBe(true);
    });

    it('should handle quoted values', () => {
        const result = parser.parse('echo --msg="hello world"');
        expect(result.args[0].value).toBe('hello world');
    });

    it('should return empty command on invalid input', () => {
        const result = parser.parse('');
        expect(result.commandName).toBe('');
    });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/nicolaelupei/Documents/Personal/angular-web-cli
ng test cli --watch=false --browsers=ChromeHeadless
```

Expected: FAIL — no source files found.

**Step 3: Copy CommandParser to @qodalis/cli**

Copy `projects/angular-cli/src/lib/utils/command-parser.ts` to `projects/cli/src/lib/parsers/command-parser.ts`. The file is pure TypeScript with zero imports — copy as-is.

**Step 4: Copy ArgsParser to @qodalis/cli**

Copy `projects/angular-cli/src/lib/utils/args-parser.ts` to `projects/cli/src/lib/parsers/args-parser.ts`. Update the import path:

```typescript
import {
    ICliCommandProcessor,
    ICliCommandParameterDescriptor,
} from '@qodalis/cli-core';
import { ParsedArg } from './command-parser';
```

**Step 5: Create parsers/index.ts**

```typescript
export { CommandParser, ParsedArg, CommandParserOutput } from './command-parser';
export { CliArgsParser } from './args-parser';
```

**Step 6: Copy arrays utility**

Copy `projects/angular-cli/src/lib/utils/arrays.ts` to `projects/cli/src/lib/utils/arrays.ts` (pure function, no imports).

Create `projects/cli/src/lib/utils/index.ts`:
```typescript
export { groupBy } from './arrays';
```

**Step 7: Copy ProcessExitedError**

Create `projects/cli/src/lib/errors/index.ts`:

```typescript
export class ProcessExitedError extends Error {
    code: number;

    constructor(code: number) {
        super(`Process exited with code ${code}`);
        this.name = 'ProcessExitedError';
        this.code = code;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
```

**Step 8: Update lib/index.ts to export everything**

```typescript
export * from './parsers';
export * from './utils';
export * from './errors';
```

**Step 9: Update public-api.ts**

```typescript
/*
 * Public API Surface of @qodalis/cli
 */

export * from './lib/index';
```

**Step 10: Run tests**

```bash
ng test cli --watch=false --browsers=ChromeHeadless
```

Expected: PASS — CommandParser tests pass.

**Step 11: Update angular-cli to re-export from @qodalis/cli**

Replace contents of `projects/angular-cli/src/lib/utils/command-parser.ts`:
```typescript
export { CommandParser, ParsedArg, CommandParserOutput } from '@qodalis/cli';
```

Replace contents of `projects/angular-cli/src/lib/utils/args-parser.ts`:
```typescript
export { CliArgsParser } from '@qodalis/cli';
```

Replace contents of `projects/angular-cli/src/lib/utils/arrays.ts`:
```typescript
export { groupBy } from '@qodalis/cli';
```

Replace contents of `projects/angular-cli/src/lib/cli/context/errors/index.ts`:
```typescript
export { ProcessExitedError } from '@qodalis/cli';
```

**Step 12: Verify full build**

```bash
ng build core && ng build cli && ng build angular-cli
```

Expected: All three build successfully.

**Step 13: Commit**

```bash
git add -A
git commit -m "refactor: move parsers and utilities to @qodalis/cli

Moves CommandParser, CliArgsParser, groupBy, and ProcessExitedError
to the framework-agnostic package. angular-cli re-exports for compat."
```

---

### Task 4: Move processor registry to `@qodalis/cli`

The `CliCommandProcessorRegistry` is pure logic wrapped in `@Injectable()`. Move the pure logic.

**Files:**
- Create: `projects/cli/src/lib/registry/cli-command-processor-registry.ts`
- Create: `projects/cli/src/lib/registry/index.ts`
- Modify: `projects/cli/src/lib/index.ts`
- Modify: `projects/angular-cli/src/lib/cli/services/cli-command-processor-registry.ts` → delegate to @qodalis/cli

**Step 1: Write test for registry**

Create `projects/cli/src/tests/registry.spec.ts`:
```typescript
import { CliCommandProcessorRegistry } from '../lib/registry';
import { ICliCommandProcessor } from '@qodalis/cli-core';

const createProcessor = (command: string, aliases?: string[]): ICliCommandProcessor => ({
    command,
    aliases,
    description: `Test ${command}`,
    async processCommand() {},
});

describe('CliCommandProcessorRegistry', () => {
    let registry: CliCommandProcessorRegistry;

    beforeEach(() => {
        registry = new CliCommandProcessorRegistry();
    });

    it('should register and find a processor', () => {
        const proc = createProcessor('test');
        registry.registerProcessor(proc);
        expect(registry.findProcessor('test', [])).toBe(proc);
    });

    it('should find processor by alias', () => {
        const proc = createProcessor('test', ['t']);
        registry.registerProcessor(proc);
        expect(registry.findProcessor('t', [])).toBe(proc);
    });

    it('should return undefined for unknown command', () => {
        expect(registry.findProcessor('unknown', [])).toBeUndefined();
    });

    it('should unregister a processor', () => {
        const proc = createProcessor('test');
        registry.registerProcessor(proc);
        registry.unregisterProcessor(proc);
        expect(registry.findProcessor('test', [])).toBeUndefined();
    });

    it('should not unregister a sealed processor', () => {
        const proc = createProcessor('test');
        proc.metadata = { sealed: true };
        registry.registerProcessor(proc);
        registry.unregisterProcessor(proc);
        expect(registry.findProcessor('test', [])).toBe(proc);
    });

    it('should replace an existing processor', () => {
        const proc1 = createProcessor('test');
        const proc2 = createProcessor('test');
        proc2.description = 'Replaced';
        registry.registerProcessor(proc1);
        registry.registerProcessor(proc2);
        expect(registry.findProcessor('test', [])?.description).toBe('Replaced');
    });
});
```

**Step 2: Run test to verify it fails**

```bash
ng test cli --watch=false --browsers=ChromeHeadless
```

Expected: FAIL — registry module not found.

**Step 3: Create the registry (stripped of @Injectable)**

Create `projects/cli/src/lib/registry/cli-command-processor-registry.ts`:

```typescript
import {
    ICliCommandChildProcessor,
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
} from '@qodalis/cli-core';

export class CliCommandProcessorRegistry
    implements ICliCommandProcessorRegistry
{
    public readonly processors: ICliCommandProcessor[] = [];

    constructor(initialProcessors?: ICliCommandProcessor[]) {
        if (initialProcessors) {
            this.processors.push(...initialProcessors);
        }
    }

    public registerProcessor(processor: ICliCommandProcessor): void {
        const existingProcessor = this.getProcessorByName(processor.command);

        if (existingProcessor) {
            if (existingProcessor.metadata?.sealed) {
                console.warn(
                    `Processor with command: ${processor.command} is sealed and cannot be replaced.`,
                );
                return;
            }

            const existingIndex = this.processors.findIndex(
                (p) => p.command === processor.command,
            );

            this.processors[existingIndex] = processor;
        } else {
            this.processors.push(processor);
        }
    }

    public unregisterProcessor(processor: ICliCommandProcessor): void {
        const existingProcessor = this.getProcessorByName(processor.command);

        if (existingProcessor) {
            if (existingProcessor.metadata?.sealed) {
                console.warn(
                    `Processor with command: ${processor.command} is sealed and cannot be removed.`,
                );
                return;
            }
        }

        const index = this.processors.findIndex(
            (p) => p.command === processor.command,
        );

        if (index !== -1) {
            this.processors.splice(index, 1);
        }
    }

    public findProcessor(
        mainCommand: string,
        chainCommands: string[],
    ): ICliCommandProcessor | undefined {
        return this.findProcessorInCollection(
            mainCommand,
            chainCommands,
            this.processors,
        );
    }

    public findProcessorInCollection(
        mainCommand: string,
        chainCommands: string[],
        processors: ICliCommandProcessor[],
    ): ICliCommandProcessor | undefined {
        const lowerCommand = mainCommand.toLowerCase();
        const processor = processors.find(
            (p) =>
                p.command.toLowerCase() === lowerCommand ||
                p.aliases?.some(
                    (a) => a.toLowerCase() === lowerCommand,
                ),
        );

        if (!processor) {
            return undefined;
        }

        if (chainCommands.length === 0) {
            return processor;
        }

        if (processor.processors && processor.processors.length > 0) {
            return this.findProcessorInCollection(
                chainCommands[0],
                chainCommands.slice(1),
                processor.processors,
            );
        } else if (processor.allowUnlistedCommands || processor.valueRequired) {
            return processor;
        }

        return undefined;
    }

    public getRootProcessor(
        child: ICliCommandChildProcessor,
    ): ICliCommandProcessor {
        return child.parent ? this.getRootProcessor(child.parent) : child;
    }

    private getProcessorByName(name: string): ICliCommandProcessor | undefined {
        return this.processors.find(
            (p) => p.command.toLowerCase() === name.toLowerCase(),
        );
    }
}
```

Create `projects/cli/src/lib/registry/index.ts`:
```typescript
export { CliCommandProcessorRegistry } from './cli-command-processor-registry';
```

**Step 4: Update lib/index.ts**

```typescript
export * from './parsers';
export * from './utils';
export * from './errors';
export * from './registry';
```

**Step 5: Run tests**

```bash
ng test cli --watch=false --browsers=ChromeHeadless
```

Expected: PASS.

**Step 6: Update angular-cli's registry to extend from @qodalis/cli**

Replace `projects/angular-cli/src/lib/cli/services/cli-command-processor-registry.ts`:

```typescript
import { Injectable } from '@angular/core';
import { ICliCommandProcessorRegistry } from '@qodalis/cli-core';
import { CliCommandProcessorRegistry as BaseRegistry } from '@qodalis/cli';
import { miscProcessors } from '../processors';

@Injectable()
export class CliCommandProcessorRegistry
    extends BaseRegistry
    implements ICliCommandProcessorRegistry
{
    constructor() {
        super([...miscProcessors]);
    }
}
```

**Step 7: Verify full build**

```bash
ng build core && ng build cli && ng build angular-cli
```

Expected: All three build successfully.

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor: move CliCommandProcessorRegistry to @qodalis/cli

Extracts the framework-agnostic processor registry as a plain class.
Angular-cli extends it with @Injectable() and built-in processors."
```

---

### Task 5: Move pure command processors to `@qodalis/cli`

Move the 26 processors that have zero Angular imports (all misc + eval).

**Files:**
- Create: `projects/cli/src/lib/processors/` (copy 26 processor files from angular-cli)
- Create: `projects/cli/src/lib/processors/index.ts`
- Modify: `projects/cli/src/lib/index.ts`
- Modify: `projects/angular-cli/src/lib/cli/processors/misc/index.ts` → import from @qodalis/cli
- Modify: `projects/angular-cli/src/lib/cli/processors/index.ts` → re-export from @qodalis/cli

**Step 1: Copy all pure processor files**

Copy these files from `projects/angular-cli/src/lib/cli/processors/misc/` to `projects/cli/src/lib/processors/`:
- `cli-alias-command-processor.ts`
- `cli-base64-command-processor.ts`
- `cli-cal-command-processor.ts`
- `cli-clear-command-processor.ts`
- `cli-clipboard-command-processor.ts`
- `cli-color-command-processor.ts`
- `cli-convert-command-processor.ts`
- `cli-echo-command-processor.ts`
- `cli-hash-command-processor.ts`
- `cli-hex-command-processor.ts`
- `cli-json-command-processor.ts`
- `cli-jwt-command-processor.ts`
- `cli-lorem-command-processor.ts`
- `cli-open-command-processor.ts`
- `cli-random-command-processor.ts`
- `cli-screen-command-processor.ts`
- `cli-seq-command-processor.ts`
- `cli-sleep-command-processor.ts`
- `cli-time-command-processor.ts`
- `cli-timestamp-command-processor.ts`
- `cli-unalias-command-processor.ts`
- `cli-uname-command-processor.ts`
- `cli-uptime-command-processor.ts`
- `cli-url-command-processor.ts`
- `cli-yes-command-processor.ts`

Also copy from `projects/angular-cli/src/lib/cli/processors/`:
- `cli-eval-command-processor.ts`

All of these are pure TypeScript classes that only import from `@qodalis/cli-core`. No changes needed to the code.

**Step 2: Create processors/index.ts**

```typescript
export * from './cli-echo-command-processor';
export * from './cli-clear-command-processor';
export * from './cli-alias-command-processor';
export * from './cli-unalias-command-processor';
export * from './cli-sleep-command-processor';
export * from './cli-time-command-processor';
export * from './cli-base64-command-processor';
export * from './cli-json-command-processor';
export * from './cli-url-command-processor';
export * from './cli-hash-command-processor';
export * from './cli-random-command-processor';
export * from './cli-uptime-command-processor';
export * from './cli-open-command-processor';
export * from './cli-lorem-command-processor';
export * from './cli-timestamp-command-processor';
export * from './cli-color-command-processor';
export * from './cli-jwt-command-processor';
export * from './cli-cal-command-processor';
export * from './cli-seq-command-processor';
export * from './cli-screen-command-processor';
export * from './cli-hex-command-processor';
export * from './cli-clipboard-command-processor';
export * from './cli-convert-command-processor';
export * from './cli-yes-command-processor';
export * from './cli-eval-command-processor';
```

Also create a `miscProcessors` array in the same file (import the class constructors and instantiate):

```typescript
import { CliClearCommandProcessor } from './cli-clear-command-processor';
import { CliEchoCommandProcessor } from './cli-echo-command-processor';
import { CliEvalCommandProcessor } from './cli-eval-command-processor';
import { CliAliasCommandProcessor } from './cli-alias-command-processor';
import { CliUnAliasCommandProcessor } from './cli-unalias-command-processor';
import { CliSleepCommandProcessor } from './cli-sleep-command-processor';
import { CliUnameCommandProcessor } from './cli-uname-command-processor';
import { CliTimeCommandProcessor } from './cli-time-command-processor';
import { CliBase64CommandProcessor } from './cli-base64-command-processor';
import { CliJsonCommandProcessor } from './cli-json-command-processor';
import { CliUrlCommandProcessor } from './cli-url-command-processor';
import { CliHashCommandProcessor } from './cli-hash-command-processor';
import { CliRandomCommandProcessor } from './cli-random-command-processor';
import { CliUptimeCommandProcessor } from './cli-uptime-command-processor';
import { CliOpenCommandProcessor } from './cli-open-command-processor';
import { CliLoremCommandProcessor } from './cli-lorem-command-processor';
import { CliTimestampCommandProcessor } from './cli-timestamp-command-processor';
import { CliColorCommandProcessor } from './cli-color-command-processor';
import { CliJwtCommandProcessor } from './cli-jwt-command-processor';
import { CliCalCommandProcessor } from './cli-cal-command-processor';
import { CliSeqCommandProcessor } from './cli-seq-command-processor';
import { CliScreenCommandProcessor } from './cli-screen-command-processor';
import { CliHexCommandProcessor } from './cli-hex-command-processor';
import { CliClipboardCommandProcessor } from './cli-clipboard-command-processor';
import { CliConvertCommandProcessor } from './cli-convert-command-processor';
import { CliYesCommandProcessor } from './cli-yes-command-processor';

export const miscProcessors = [
    new CliClearCommandProcessor(),
    new CliEchoCommandProcessor(),
    new CliEvalCommandProcessor(),
    new CliAliasCommandProcessor(),
    new CliUnAliasCommandProcessor(),
    new CliSleepCommandProcessor(),
    new CliUnameCommandProcessor(),
    new CliTimeCommandProcessor(),
    new CliBase64CommandProcessor(),
    new CliJsonCommandProcessor(),
    new CliUrlCommandProcessor(),
    new CliHashCommandProcessor(),
    new CliRandomCommandProcessor(),
    new CliUptimeCommandProcessor(),
    new CliOpenCommandProcessor(),
    new CliLoremCommandProcessor(),
    new CliTimestampCommandProcessor(),
    new CliColorCommandProcessor(),
    new CliJwtCommandProcessor(),
    new CliCalCommandProcessor(),
    new CliSeqCommandProcessor(),
    new CliScreenCommandProcessor(),
    new CliHexCommandProcessor(),
    new CliClipboardCommandProcessor(),
    new CliConvertCommandProcessor(),
    new CliYesCommandProcessor(),
];
```

**Step 3: Update lib/index.ts**

```typescript
export * from './parsers';
export * from './utils';
export * from './errors';
export * from './registry';
export * from './processors';
```

**Step 4: Update angular-cli to import from @qodalis/cli**

Replace `projects/angular-cli/src/lib/cli/processors/misc/index.ts`:

```typescript
// Re-export all processor classes and miscProcessors from @qodalis/cli
export {
    CliEchoCommandProcessor,
    CliClearCommandProcessor,
    CliAliasCommandProcessor,
    CliUnAliasCommandProcessor,
    CliSleepCommandProcessor,
    CliTimeCommandProcessor,
    CliBase64CommandProcessor,
    CliJsonCommandProcessor,
    CliUrlCommandProcessor,
    CliHashCommandProcessor,
    CliRandomCommandProcessor,
    CliUptimeCommandProcessor,
    CliOpenCommandProcessor,
    CliLoremCommandProcessor,
    CliTimestampCommandProcessor,
    CliColorCommandProcessor,
    CliJwtCommandProcessor,
    CliCalCommandProcessor,
    CliSeqCommandProcessor,
    CliScreenCommandProcessor,
    CliHexCommandProcessor,
    CliClipboardCommandProcessor,
    CliConvertCommandProcessor,
    CliYesCommandProcessor,
    miscProcessors,
} from '@qodalis/cli';
```

Update `projects/angular-cli/src/lib/cli/processors/index.ts`:

```typescript
export { CliPingCommandProcessor } from './cli-ping-command-processor';

export { CliEvalCommandProcessor } from '@qodalis/cli';

export * from './system';

export * from './misc';

export * from './users';
```

Note: Delete the original processor files from `projects/angular-cli/src/lib/cli/processors/misc/` (all 25 individual files) and `projects/angular-cli/src/lib/cli/processors/cli-eval-command-processor.ts`.

**Step 5: Verify full build**

```bash
ng build core && ng build cli && ng build angular-cli
```

Expected: All three build successfully.

**Step 6: Build all to verify plugins still work**

```bash
npm run "build all"
```

Expected: Full build succeeds including all plugins.

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: move 26 pure command processors to @qodalis/cli

Moves all framework-agnostic processors (misc + eval) to the new
package. angular-cli re-exports them for backward compatibility."
```

---

### Task 6: Move CliExecutionProcess and CliCommandExecutionContext to `@qodalis/cli`

These are pure logic classes with no Angular imports.

**Files:**
- Create: `projects/cli/src/lib/context/cli-execution-process.ts`
- Create: `projects/cli/src/lib/context/cli-command-execution-context.ts`
- Create: `projects/cli/src/lib/context/index.ts`
- Modify: `projects/cli/src/lib/index.ts`
- Modify: `projects/angular-cli/src/lib/cli/context/cli-execution-process.ts` → re-export
- Modify: `projects/angular-cli/src/lib/cli/context/cli-command-executution-context.ts` → re-export

**Step 1: Copy CliExecutionProcess**

Copy `projects/angular-cli/src/lib/cli/context/cli-execution-process.ts` to `projects/cli/src/lib/context/cli-execution-process.ts`.

Update the import to use the local ProcessExitedError:
```typescript
import { ICliExecutionContext, ICliExecutionProcess } from '@qodalis/cli-core';
import { ProcessExitedError } from '../errors';
```

Rest of the file stays the same.

**Step 2: Copy CliCommandExecutionContext**

Copy `projects/angular-cli/src/lib/cli/context/cli-command-executution-context.ts` to `projects/cli/src/lib/context/cli-command-execution-context.ts` (fix the typo in filename).

Read the original file first to verify its contents and ensure imports are updated to use `@qodalis/cli-core` and local modules.

**Step 3: Create context/index.ts**

```typescript
export * from './cli-execution-process';
export * from './cli-command-execution-context';
```

**Step 4: Update lib/index.ts**

Add:
```typescript
export * from './context';
```

**Step 5: Update angular-cli re-exports**

Replace `projects/angular-cli/src/lib/cli/context/cli-execution-process.ts`:
```typescript
export { CliExecutionProcess } from '@qodalis/cli';
```

Replace `projects/angular-cli/src/lib/cli/context/cli-command-executution-context.ts`:
```typescript
export { CliCommandExecutionContext } from '@qodalis/cli';
```

**Step 6: Verify full build**

```bash
ng build core && ng build cli && ng build angular-cli
```

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: move execution process and command context to @qodalis/cli"
```

---

### Task 7: Move command executor logic to `@qodalis/cli`

Extract the core execution logic from `CliCommandExecutorService` as a plain class.

**Files:**
- Create: `projects/cli/src/lib/executor/cli-command-executor.ts`
- Create: `projects/cli/src/lib/executor/index.ts`
- Modify: `projects/cli/src/lib/index.ts`
- Modify: `projects/angular-cli/src/lib/cli/services/cli-command-executor.service.ts` → extend from @qodalis/cli

**Step 1: Create the framework-agnostic executor**

Create `projects/cli/src/lib/executor/cli-command-executor.ts`:

The executor logic is identical to the Angular version but without `@Injectable` and `@Inject`. Instead of DI injection, the registry is passed via constructor parameter.

```typescript
import {
    ICliExecutionContext,
    ICliCommandProcessor,
    CliProcessCommand,
    getRightOfWord,
    getParameterValue,
    ICliCommandExecutorService,
    CancellablePromise,
    CliForegroundColor,
    ICliCommandProcessorRegistry,
} from '@qodalis/cli-core';
import { CommandParser } from '../parsers';
import { CliExecutionProcess } from '../context/cli-execution-process';
import { CliArgsParser } from '../parsers/args-parser';
import { ProcessExitedError } from '../errors';
import { CliCommandExecutionContext } from '../context/cli-command-execution-context';

export class CliCommandExecutor implements ICliCommandExecutorService {
    private commandParser: CommandParser = new CommandParser();

    constructor(
        protected readonly registry: ICliCommandProcessorRegistry,
    ) {}

    // ... (copy all methods from CliCommandExecutorService, removing Angular decorators)
    // The logic stays identical
}
```

Copy all method bodies from `projects/angular-cli/src/lib/cli/services/cli-command-executor.service.ts`. The only changes:
1. Remove `@Injectable()` and `@Inject()` decorators
2. Class name is `CliCommandExecutor` (not `CliCommandExecutorService`)
3. Constructor takes `registry` directly instead of via DI token
4. The reference to `CliAliasCommandProcessor` needs to be imported from `@qodalis/cli` (since it moved in Task 5)

Note: The `CliExecutionContext` class (referenced as type cast on lines 41-46 and 255) still lives in angular-cli. For the executor in @qodalis/cli, we need to handle this. The simplest approach: accept `ICliExecutionContext` interface everywhere (which is from cli-core) and use duck-typing for the `abort()` method. Import the concrete `CliExecutionContext` from `@qodalis/cli` only if it has been moved, otherwise use interface-only typing.

For now, the executor references `CliExecutionContext` for `.abort()` and `.contextProcessor`. Since `CliExecutionContext` (the 488-line implementation) hasn't been moved yet and has heavier dependencies, we should keep those references via the `ICliExecutionContext` interface. Add `abort()` and `contextProcessor` to the interface check.

Create `projects/cli/src/lib/executor/index.ts`:
```typescript
export { CliCommandExecutor } from './cli-command-executor';
```

**Step 2: Update lib/index.ts**

Add:
```typescript
export * from './executor';
```

**Step 3: Update angular-cli's executor to extend**

Replace `projects/angular-cli/src/lib/cli/services/cli-command-executor.service.ts`:

```typescript
import { Inject, Injectable } from '@angular/core';
import {
    ICliCommandExecutorService,
    ICliCommandProcessorRegistry,
} from '@qodalis/cli-core';
import { CliCommandExecutor } from '@qodalis/cli';
import { CliProcessorsRegistry_TOKEN } from '../tokens';

@Injectable({
    providedIn: 'root',
})
export class CliCommandExecutorService
    extends CliCommandExecutor
    implements ICliCommandExecutorService
{
    constructor(
        @Inject(CliProcessorsRegistry_TOKEN)
        registry: ICliCommandProcessorRegistry,
    ) {
        super(registry);
    }
}
```

**Step 4: Verify full build**

```bash
ng build core && ng build cli && ng build angular-cli
```

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: extract CliCommandExecutor to @qodalis/cli

Framework-agnostic command execution engine. Angular-cli extends
with @Injectable() for DI integration."
```

---

### Task 8: Full build and integration verification

**Files:**
- No new files

**Step 1: Full build**

```bash
npm run "build all"
```

Expected: All projects build successfully: core, cli, angular-cli, all 12 plugins, demo.

**Step 2: Run tests**

```bash
npm test
```

Expected: All existing tests pass.

**Step 3: Run lint**

```bash
npm run lint
```

Expected: No new lint errors.

**Step 4: Start demo and manual test**

```bash
npm run "start demo"
```

Visit `http://localhost:4300`. Verify:
- Terminal renders
- `echo hello` works
- `help` lists all commands
- `base64 encode hello` works
- `eval 1 + 1` works
- Plugin commands (guid, etc.) work if modules are imported

**Step 5: Verify package contents**

```bash
ls dist/cli/
```

Expected: Contains the built @qodalis/cli package with parsers, registry, processors, context, executor, utils, errors.

```bash
ls dist/angular-cli/
```

Expected: Contains the built @qodalis/angular-cli package (thinner now — delegates to @qodalis/cli).

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: verify full build after CLI framework split"
```

---

## Summary of what moves where

| Component | From | To | Strategy |
|---|---|---|---|
| CommandParser, ArgsParser | angular-cli/utils | cli/parsers | Copy, re-export from angular-cli |
| groupBy | angular-cli/utils/arrays | cli/utils | Copy, re-export |
| ProcessExitedError | angular-cli/context/errors | cli/errors | Copy, re-export |
| CliCommandProcessorRegistry | angular-cli/services | cli/registry | Copy without @Injectable, angular-cli extends |
| 26 pure processors | angular-cli/processors/misc + eval | cli/processors | Copy, re-export from angular-cli |
| CliExecutionProcess | angular-cli/context | cli/context | Copy, re-export |
| CliCommandExecutionContext | angular-cli/context | cli/context | Copy, re-export |
| CliCommandExecutor | angular-cli/services (executor) | cli/executor | Extract logic, angular-cli extends |

## What stays in angular-cli

- All Angular components (CliComponent, CliPanelComponent, CliTerminalComponent)
- CliModule, CliPanelModule
- All Angular DI tokens and providers
- `resolveCommandProcessorProvider()`, `resolveCliProvider()`
- `resolveCliProviders()` function
- CliExecutionContext (the 488-line terminal integration class)
- Angular-coupled processors: help, version, feedback, history, packages, hotkeys, theme, ping, user processors
- Angular services: user session, users store, state store manager, logger, service provider, script loader
- CliStateStore (uses RxJS BehaviorSubject)
- CliKeyValueStore (uses IndexedDB — could move later)

## Future work (not in this plan)

1. Replace RxJS in `ICliExecutionContext` and `ICliStateStore` interfaces with callbacks
2. Move `CliExecutionContext` (terminal integration) to @qodalis/cli
3. Move `CliStateStore` and `CliKeyValueStore` to @qodalis/cli (after RxJS removal)
4. Move Angular-coupled processors to @qodalis/cli (after DI container is built)
5. Switch @qodalis/cli build from ng-packagr to tsup/rollup (remove Angular peer dep)
6. Split plugins into core + angular packages
7. Create `@qodalis/react-cli` and `@qodalis/vue-cli` bindings

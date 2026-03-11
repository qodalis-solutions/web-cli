# Yes/No Generator Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `yesno` CLI plugin that generates random yes/no answers with a slot machine animation.

**Architecture:** Standard Angular library plugin following the guid plugin pattern. A single `CliYesnoCommandProcessor` handles the `yesno` command. Animation is done via raw `context.terminal.write()` calls with ANSI escape codes and `setTimeout` chains for deceleration. The command accepts an optional question as `command.value` and a `--count` parameter.

**Tech Stack:** Angular 16, TypeScript, xterm.js (via `context.terminal`)

---

### Task 1: Scaffold plugin directory structure

**Files:**
- Create: `projects/yesno/package.json`
- Create: `projects/yesno/ng-package.json`
- Create: `projects/yesno/rollup.config.mjs`
- Create: `projects/yesno/tsconfig.lib.json`
- Create: `projects/yesno/tsconfig.lib.prod.json`
- Create: `projects/yesno/tsconfig.spec.json`
- Create: `projects/yesno/tsconfig.browser.json`
- Create: `projects/yesno/README.md`
- Create: `projects/yesno/src/public-api.ts`
- Create: `projects/yesno/src/cli-entrypoint.ts`
- Create: `projects/yesno/src/lib/index.ts`
- Create: `projects/yesno/src/lib/version.ts`

**Step 1: Create `projects/yesno/package.json`**

```json
{
  "name": "@qodalis/cli-yesno",
  "version": "1.0.0",
  "description": "An Angular CLI extension for generating random yes/no answers with animations.",
  "author": "Nicolae Lupei, Qodalis Solutions",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/qodalis-solutions/angular-web-cli"
  },
  "homepage": "https://qodalis.com",
  "keywords": [
    "angular",
    "cli",
    "qodalis",
    "terminal",
    "yesno"
  ],
  "umd": "./umd/index.js",
  "unpkg": "./umd/index.js",
  "peerDependencies": {
    "@angular/common": "^16.2.0",
    "@angular/core": "^16.2.0"
  },
  "dependencies": {
    "tslib": "^2.3.0",
    "@qodalis/cli-core": "^0.0.16",
    "@qodalis/angular-cli": "^1.0.39"
  },
  "sideEffects": false,
  "scripts": {
    "tsc-compilejs": "tsc -p tsconfig.browser.json",
    "rollup-compile": "npx rollup -c"
  }
}
```

**Step 2: Create `projects/yesno/ng-package.json`**

```json
{
  "$schema": "../../node_modules/ng-packagr/ng-package.schema.json",
  "dest": "../../dist/yesno",
  "lib": {
    "entryFile": "src/public-api.ts"
  },
  "allowedNonPeerDependencies": ["@qodalis/cli-core", "@qodalis/angular-cli"]
}
```

**Step 3: Create `projects/yesno/rollup.config.mjs`**

```javascript
import { baseConfig, buildLibraryOutputConfig } from "../../rollup.shared.mjs";

export default {
  ...baseConfig,
  input: "src/cli-entrypoint.ts",
  output: {
    ...buildLibraryOutputConfig("yesno"),
  },
};
```

**Step 4: Create tsconfig files**

`projects/yesno/tsconfig.lib.json`:
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

`projects/yesno/tsconfig.lib.prod.json`:
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

`projects/yesno/tsconfig.spec.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "../../out-tsc/spec",
    "types": [
      "jasmine"
    ]
  },
  "include": [
    "**/*.spec.ts",
    "**/*.d.ts"
  ]
}
```

`projects/yesno/tsconfig.browser.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "module": "umd",
    "target": "es5",
    "outDir": "../../dist/yesno",
    "lib": ["dom", "es5"],
    "declaration": false,
    "declarationMap": false,
    "sourceMap": false,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "files": ["src/cli-entrypoint.ts"]
}
```

**Step 5: Create `projects/yesno/src/lib/version.ts`**

```typescript

// Automatically generated during build
export const LIBRARY_VERSION = '1.0.0';
```

**Step 6: Create `projects/yesno/src/lib/index.ts`**

```typescript
export * from './processors/cli-yesno-command-processor';
```

**Step 7: Create `projects/yesno/src/public-api.ts`**

```typescript
/*
 * Public API Surface of yesno
 */

export * from './lib/cli-yesno.module';

export * from './lib/processors/cli-yesno-command-processor';

export * from './lib/version';
```

**Step 8: Create `projects/yesno/src/cli-entrypoint.ts`**

```typescript
import { bootUmdModule, ICliUmdModule } from '@qodalis/cli-core';
import { CliYesnoCommandProcessor } from './lib';

const module: ICliUmdModule = {
    name: '@qodalis/cli-yesno',
    processors: [new CliYesnoCommandProcessor()],
};

bootUmdModule(module);
```

**Step 9: Create `projects/yesno/README.md`**

```markdown
# Cli extension

The `@qodalis/cli-yesno` package is a CLI extension that generates random yes/no answers with a slot machine animation.

# Installation

\`\`\`bash
packages add @qodalis/cli-yesno
\`\`\`

# Usage

\`\`\`bash
yesno
yesno Should I deploy to production?
yesno --count=3
\`\`\`

This command downloads and registers the extension for use within the CLI environment.
```

**Step 10: Commit**

```bash
git add projects/yesno/
git commit -m "feat(yesno): scaffold plugin directory structure"
```

---

### Task 2: Create the NgModule

**Files:**
- Create: `projects/yesno/src/lib/cli-yesno.module.ts`

**Step 1: Create `projects/yesno/src/lib/cli-yesno.module.ts`**

```typescript
import { NgModule } from '@angular/core';
import { resolveCommandProcessorProvider } from '@qodalis/angular-cli';
import { CliYesnoCommandProcessor } from './processors/cli-yesno-command-processor';

@NgModule({
    declarations: [],
    imports: [],
    exports: [],
    providers: [resolveCommandProcessorProvider(CliYesnoCommandProcessor)],
})
export class CliYesnoModule {}
```

**Step 2: Commit**

```bash
git add projects/yesno/src/lib/cli-yesno.module.ts
git commit -m "feat(yesno): add NgModule with provider registration"
```

---

### Task 3: Implement the command processor with slot machine animation

**Files:**
- Create: `projects/yesno/src/lib/processors/cli-yesno-command-processor.ts`

**Step 1: Create the command processor**

This is the main implementation. The slot machine animation works by:
1. Writing a box frame with YES or NO
2. Clearing the frame via ANSI codes (`\x1b[2K` clear line, `\x1b[A` move up)
3. Redrawing with the opposite value
4. Using `setTimeout` chains with exponentially increasing delays (60ms -> ~500ms)
5. Landing on a random result with colored output

```typescript
import { Injectable } from '@angular/core';
import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliCommandParameterDescriptor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

const RESET = '\x1b[0m';
const GREEN = '\x1b[38;5;82m';
const RED = '\x1b[38;5;196m';
const CYAN = '\x1b[38;5;45m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const GREEN_BG = '\x1b[48;5;22m';
const RED_BG = '\x1b[48;5;52m';

@Injectable()
export class CliYesnoCommandProcessor implements ICliCommandProcessor {
    command = 'yesno';

    description = 'Generate a random yes/no answer with animation';

    allowUnlistedCommands = true;

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    metadata?: CliProcessorMetadata | undefined = {
        icon: '🎰',
    };

    parameters?: ICliCommandParameterDescriptor[] = [
        {
            name: 'count',
            aliases: ['n'],
            description: 'Number of rounds to run (default: 1)',
            required: false,
            type: 'number',
            defaultValue: '1',
        },
    ];

    processors?: ICliCommandProcessor[] | undefined = [];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const count = parseInt(command.args['count'] || command.args['n']) || 1;
        const question = command.value?.trim();

        if (question) {
            context.writer.writeln(
                `${CYAN}?${RESET} ${BOLD}${question}${RESET}`,
            );
            context.writer.writeln();
        }

        for (let i = 0; i < count; i++) {
            if (i > 0) {
                context.writer.writeln();
            }

            await this.runSlotMachine(context);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description);
        writer.writeln();
        writer.writeln(
            `  ${writer.wrapInColor('yesno', CliForegroundColor.Cyan)}                          Generate a random yes/no`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('yesno Should I deploy?', CliForegroundColor.Cyan)}      Ask a question`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('yesno --count=5', CliForegroundColor.Cyan)}               Run 5 rounds`,
        );
    }

    private runSlotMachine(context: ICliExecutionContext): Promise<void> {
        return new Promise<void>((resolve) => {
            const result = Math.random() < 0.5;
            const totalSteps = 20;
            let step = 0;
            let aborted = false;

            const subscription = context.onAbort.subscribe(() => {
                aborted = true;
                subscription.unsubscribe();
                this.clearBox(context);
                context.writer.writeln(
                    `${DIM}(cancelled)${RESET}`,
                );
                resolve();
            });

            const animate = () => {
                if (aborted) {
                    return;
                }

                this.clearBox(context);

                const isLast = step === totalSteps;
                const currentValue = isLast
                    ? result
                    : step % 2 === 0;

                this.drawBox(context, currentValue, isLast);

                step++;

                if (step <= totalSteps) {
                    const baseDelay = 60;
                    const progress = step / totalSteps;
                    const delay = baseDelay + Math.pow(progress, 3) * 440;
                    setTimeout(animate, delay);
                } else {
                    subscription.unsubscribe();
                    context.writer.writeln();
                    const label = result ? 'YES' : 'NO';
                    const color = result ? GREEN : RED;
                    context.writer.writeln(
                        `  ${color}${BOLD}The answer is: ${label}${RESET}`,
                    );
                    resolve();
                }
            };

            animate();
        });
    }

    private drawBox(
        context: ICliExecutionContext,
        value: boolean,
        isFinal: boolean,
    ): void {
        const label = value ? ' YES ' : '  NO ';
        const color = isFinal
            ? value
                ? GREEN
                : RED
            : CYAN;
        const bgColor = isFinal
            ? value
                ? GREEN_BG
                : RED_BG
            : '';
        const border = isFinal ? color : DIM;

        const top = `  ${border}+-----------+${RESET}`;
        const mid = `  ${border}|${RESET} ${bgColor}${color}${BOLD}  > ${label} <  ${RESET} ${border}|${RESET}`;
        const bot = `  ${border}+-----------+${RESET}`;

        context.terminal.write(`${top}\r\n${mid}\r\n${bot}`);
    }

    private clearBox(context: ICliExecutionContext): void {
        // Move up 3 lines and clear each (box is 3 lines tall)
        // On first call there's nothing to clear, but the ANSI codes are harmless
        for (let i = 0; i < 3; i++) {
            context.terminal.write('\x1b[2K');
            if (i < 2) {
                context.terminal.write('\x1b[A');
            }
        }
        context.terminal.write('\r');
    }
}
```

**Step 2: Commit**

```bash
git add projects/yesno/src/lib/processors/cli-yesno-command-processor.ts
git commit -m "feat(yesno): implement slot machine animation command processor"
```

---

### Task 4: Register plugin in project configuration

**Files:**
- Modify: `tsconfig.json` (root) — add path alias
- Modify: `angular.json` — add library project config
- Modify: `projects/demo/src/app/app.module.ts` — import the module

**Step 1: Add path alias to `tsconfig.json`**

In the root `tsconfig.json`, add to `compilerOptions.paths`:
```json
"@qodalis/cli-yesno": ["dist/yesno"]
```

**Step 2: Add library config to `angular.json`**

Add a new project entry `"yesno"` following the exact same structure as `"guid"`:
```json
"yesno": {
    "projectType": "library",
    "root": "projects/yesno",
    "sourceRoot": "projects/yesno/src",
    "prefix": "lib",
    "architect": {
        "build": {
            "builder": "@angular-devkit/build-angular:ng-packagr",
            "options": {
                "project": "projects/yesno/ng-package.json"
            },
            "configurations": {
                "production": {
                    "tsConfig": "projects/yesno/tsconfig.lib.prod.json"
                },
                "development": {
                    "tsConfig": "projects/yesno/tsconfig.lib.json"
                }
            },
            "defaultConfiguration": "production"
        },
        "test": {
            "builder": "@angular-devkit/build-angular:karma",
            "options": {
                "tsConfig": "projects/yesno/tsconfig.spec.json",
                "polyfills": [
                    "zone.js",
                    "zone.js/testing"
                ]
            }
        }
    }
}
```

**Step 3: Import in demo app**

In `projects/demo/src/app/app.module.ts`, add:
```typescript
import { CliYesnoModule } from '@qodalis/cli-yesno';
```

And add `CliYesnoModule` to the `imports` array.

**Step 4: Commit**

```bash
git add tsconfig.json angular.json projects/demo/src/app/app.module.ts
git commit -m "feat(yesno): register plugin in build config and demo app"
```

---

### Task 5: Create test

**Files:**
- Create: `projects/yesno/src/tests/index.spec.ts`

**Step 1: Create test file**

```typescript
import { CliYesnoCommandProcessor } from '../lib/processors/cli-yesno-command-processor';

describe('CliYesnoModule', () => {
    it('processor instance should be created', () => {
        const processor = new CliYesnoCommandProcessor();

        expect(processor).toBeDefined();
    });

    it('should have correct command name', () => {
        const processor = new CliYesnoCommandProcessor();

        expect(processor.command).toBe('yesno');
    });

    it('should allow unlisted commands for question input', () => {
        const processor = new CliYesnoCommandProcessor();

        expect(processor.allowUnlistedCommands).toBe(true);
    });
});
```

**Step 2: Commit**

```bash
git add projects/yesno/src/tests/index.spec.ts
git commit -m "test(yesno): add basic processor tests"
```

---

### Task 6: Build and verify

**Step 1: Build core and cli first (dependencies)**

```bash
cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "build core" && npm run "build cli"
```

**Step 2: Build yesno plugin**

```bash
cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && ng build yesno
```

Expected: Build succeeds with output in `dist/yesno/`.

**Step 3: Build demo app**

```bash
cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "build demo"
```

Expected: Demo app builds successfully with the yesno module imported.

**Step 4: Run tests**

```bash
cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && ng test yesno --watch=false
```

Expected: All 3 tests pass.

**Step 5: Commit (if any fixes were needed)**

```bash
git add -A && git commit -m "fix(yesno): build fixes"
```

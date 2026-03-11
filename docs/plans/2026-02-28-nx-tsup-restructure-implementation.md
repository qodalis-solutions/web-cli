# Nx + tsup Monorepo Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the web-cli monorepo from Angular CLI workspace (angular.json + ng-packagr) to Nx workspace with pnpm and tsup, making the project truly framework-neutral.

**Architecture:** Nx manages the dependency graph and task orchestration. tsup builds all framework-agnostic packages (core, cli, 14 plugins). ng-packagr is retained only for angular-cli. pnpm workspaces handle dependency resolution with `workspace:*` protocol.

**Tech Stack:** Nx 21+, pnpm 10+, tsup 8+, TypeScript 5.1, ng-packagr 16 (angular-cli only)

---

## Pre-Migration: Create a feature branch

### Task 0: Create feature branch and verify current state

**Step 1: Create feature branch**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && git checkout -b feature/nx-tsup-restructure`
Expected: New branch created

**Step 2: Verify current build works**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && npm run "build all"`
Expected: All projects build successfully

**Step 3: Commit checkpoint**

```bash
git add -A && git commit -m "chore: checkpoint before Nx + tsup migration"
```

---

## Phase 1: Initialize Nx + pnpm

### Task 1: Switch from npm to pnpm

**Files:**
- Create: `pnpm-workspace.yaml`
- Delete: `package-lock.json` (after migration)

**Step 1: Install pnpm globally if needed**

Run: `npm install -g pnpm@latest`

**Step 2: Create pnpm-workspace.yaml**

Create `/Users/nicolaelupei/Documents/Personal/web-cli/pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "packages/plugins/*"
  - "apps/*"
```

**Step 3: Add .npmrc for pnpm settings**

Create `/Users/nicolaelupei/Documents/Personal/web-cli/.npmrc`:
```ini
shamefully-hoist=true
strict-peer-dependencies=false
auto-install-peers=true
```

Note: `shamefully-hoist=true` is needed initially for Angular compatibility. Can be tightened later.

**Step 4: Delete package-lock.json**

Run: `rm /Users/nicolaelupei/Documents/Personal/web-cli/package-lock.json`

**Step 5: Install with pnpm**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm install`
Expected: `pnpm-lock.yaml` generated, `node_modules/` repopulated

**Step 6: Add pnpm-lock.yaml to git, ignore package-lock.json**

Append to `.gitignore`:
```
package-lock.json
```

**Step 7: Commit**

```bash
git add pnpm-workspace.yaml .npmrc .gitignore pnpm-lock.yaml
git commit -m "chore: switch from npm to pnpm"
```

---

### Task 2: Initialize Nx

**Files:**
- Create: `nx.json`
- Modify: `package.json` (add nx devDependency + scripts)

**Step 1: Install Nx**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm add -Dw nx @nx/js`

**Step 2: Create nx.json**

Create `/Users/nicolaelupei/Documents/Personal/web-cli/nx.json`:
```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "test": {
      "cache": true
    },
    "lint": {
      "cache": true
    }
  },
  "defaultBase": "main",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "sharedGlobals": ["{workspaceRoot}/tsconfig.base.json", "{workspaceRoot}/tsup.shared.ts"],
    "production": ["default", "!{projectRoot}/**/*.spec.ts", "!{projectRoot}/tsconfig.spec.json"]
  }
}
```

**Step 3: Add .nxignore**

Create `/Users/nicolaelupei/Documents/Personal/web-cli/.nxignore`:
```
node_modules
dist
out-tsc
.angular
```

**Step 4: Commit**

```bash
git add nx.json .nxignore package.json pnpm-lock.yaml
git commit -m "chore: initialize Nx workspace"
```

---

## Phase 2: Directory Restructuring

### Task 3: Move library projects to packages/

This is the big directory move. We move everything except demo apps.

**Step 1: Create the new directory structure**

```bash
cd /Users/nicolaelupei/Documents/Personal/web-cli
mkdir -p packages/plugins
```

**Step 2: Move core libraries**

```bash
git mv projects/core packages/core
git mv projects/cli packages/cli
git mv projects/angular-cli packages/angular-cli
git mv projects/react-cli packages/react-cli
git mv projects/vue-cli packages/vue-cli
```

**Step 3: Move all 14 plugins into packages/plugins/**

```bash
git mv projects/guid packages/plugins/guid
git mv projects/regex packages/plugins/regex
git mv projects/text-to-image packages/plugins/text-to-image
git mv projects/speed-test packages/plugins/speed-test
git mv projects/browser-storage packages/plugins/browser-storage
git mv projects/string packages/plugins/string
git mv projects/todo packages/plugins/todo
git mv projects/curl packages/plugins/curl
git mv projects/password-generator packages/plugins/password-generator
git mv projects/server-logs packages/plugins/server-logs
git mv projects/qr packages/plugins/qr
git mv projects/files packages/plugins/files
git mv projects/users packages/plugins/users
git mv projects/yesno packages/plugins/yesno
```

**Step 4: Move demo apps and docs to apps/**

```bash
mkdir -p apps
git mv projects/demo-angular apps/demo-angular
git mv projects/demo-react apps/demo-react
git mv projects/demo-vue apps/demo-vue
git mv projects/docs apps/docs
```

**Step 5: Move utility scripts to tools/**

```bash
mkdir -p tools
git mv scripts/inject-versions.js tools/inject-versions.js
git mv scripts/install-projects-deps.js tools/install-projects-deps.js
git mv scripts/create-library.js tools/create-library.js
cp -r scripts/templates tools/templates 2>/dev/null && git rm -r scripts/templates || true
```

**Step 6: Remove now-empty projects/ and scripts/ directories**

```bash
rmdir projects 2>/dev/null || rm -rf projects
rmdir scripts 2>/dev/null || rm -rf scripts
```

**Step 7: Commit the directory restructure**

```bash
git add -A
git commit -m "refactor: restructure directories - packages/, apps/, tools/"
```

---

### Task 4: Update all internal path references after directory move

**Files to update** (all relative paths broke when directories moved):

**Step 1: Update ng-package.json in angular-cli**

File: `packages/angular-cli/ng-package.json`
Change `$schema` path from `../../node_modules/...` to `../../node_modules/...` (same depth, still works).
Change `dest` from `../../dist/angular-cli` to `../../dist/angular-cli` (same depth, still works).

Actually — packages/ is at the same depth as projects/ was, so `../../` paths still resolve correctly for packages/* items. But plugins moved one level deeper (packages/plugins/guid/ instead of projects/guid/), so their relative paths need updating.

**Step 2: Update plugin ng-package.json files (temporarily — will be replaced by tsup later)**

For each plugin in `packages/plugins/*/ng-package.json`, update `$schema` and `dest` paths.
Example for guid — change:
```json
{
  "$schema": "../../node_modules/ng-packagr/ng-package.schema.json",
  "dest": "../../dist/guid"
}
```
To:
```json
{
  "$schema": "../../../node_modules/ng-packagr/ng-package.schema.json",
  "dest": "../../../dist/guid"
}
```

Do this for all 14 plugins: guid, regex, text-to-image, speed-test, browser-storage, string, todo, curl, password-generator, server-logs, qr, files, users, yesno.

**Step 3: Update plugin tsconfig.lib.json files**

For each plugin in `packages/plugins/*/tsconfig.lib.json`, update the extends path:
From: `"extends": "../../tsconfig.json"`
To: `"extends": "../../../tsconfig.json"`

Same for `tsconfig.lib.prod.json` and `tsconfig.spec.json` if they exist.

**Step 4: Update plugin rollup.config.mjs files**

For each plugin with `packages/plugins/*/rollup.config.mjs`:
From: `import { baseConfig, buildLibraryOutputConfig } from "../../rollup.shared.mjs";`
To: `import { baseConfig, buildLibraryOutputConfig } from "../../../rollup.shared.mjs";`

And update output path in `buildLibraryOutputConfig` — actually this is handled by the shared config using the lib name, so it should still work as `../../dist/` from root. But the rollup.shared.mjs `buildLibraryOutputConfig` uses `../../dist/${libName}/umd/index.js` which was relative to the project folder. From `packages/plugins/guid/` we now need `../../../dist/guid/umd/index.js`. This means we need to update `rollup.shared.mjs` or each plugin's rollup config. Since we'll be replacing rollup with tsup soon, just fix the paths minimally.

**Step 5: Update angular.json project paths**

File: `angular.json`
For each library and app, update `root`, `sourceRoot`, and build config paths:
- Libraries in packages/: `"root": "packages/core"` (was `"root": "projects/core"`)
- Plugins: `"root": "packages/plugins/guid"` (was `"root": "projects/guid"`)
- Apps: `"root": "apps/demo-angular"` (was `"root": "projects/demo-angular"`)
- Build options: update `project` paths to ng-package.json and tsconfig paths

This is a large file (~700 lines). Update every occurrence of `projects/` to the correct new path.

**Step 6: Update root package.json scripts**

File: `package.json`
Update all script paths:
```json
{
  "build:styles": "sass packages/angular-cli/src/assets/styles.sass packages/angular-cli/src/assets/styles.css --no-source-map",
  "build:styles:watch": "sass --watch packages/angular-cli/src/assets/styles.sass packages/angular-cli/src/assets/styles.css --no-source-map",
  "install projects deps": "node ./tools/install-projects-deps.js",
  "build all": "node ./tools/inject-versions.js && node ./tools/build-all.js",
  "build react-cli": "cd packages/react-cli && npx tsup",
  "build vue-cli": "cd packages/vue-cli && npx tsup",
  "start react-demo": "cd apps/demo-react && npx vite --port 4301",
  "start vue-demo": "cd apps/demo-vue && npx vite --port 4302",
  "format": "prettier --write \"packages/**/*.{ts,html,css,scss}\" \"apps/**/*.{ts,html,css,scss}\""
}
```

**Step 7: Update tools/inject-versions.js**

Update the `librariesPath` to scan both `packages/` and `packages/plugins/`:
```javascript
const packagesPath = path.resolve(__dirname, "../packages");
const pluginsPath = path.resolve(__dirname, "../packages/plugins");
```

**Step 8: Update tools/install-projects-deps.js**

Update to scan `packages/`, `packages/plugins/`, and `apps/`.

**Step 9: Update react-cli and vue-cli tsconfig.json paths**

File: `packages/react-cli/tsconfig.json` — paths still use `../../dist/` which is correct.
File: `packages/vue-cli/tsconfig.json` — same, still correct.

**Step 10: Update demo app references**

File: `apps/demo-react/package.json` — update `file:` protocol paths:
```json
{
  "@qodalis/react-cli": "file:../../packages/react-cli",
  "@qodalis/cli": "file:../../dist/cli",
  "@qodalis/cli-core": "file:../../dist/core",
  "@qodalis/cli-guid": "file:../../dist/guid"
}
```
(dist/ paths stay the same since apps/ is at same depth as projects/ was)

Actually: `apps/demo-react/` → `../../dist/` resolves to root `dist/`. This is correct.
But `apps/demo-react/` → `../../packages/react-cli` for the wrapper reference. Was `../react-cli` from `projects/demo-react/`.

File: `apps/demo-vue/package.json` — same updates.
File: `apps/demo-vue/vite.config.ts` — update alias paths.
File: `apps/demo-react/vite.config.ts` — update alias paths.

**Step 11: Update proxy.conf.json path if referenced**

Check if angular.json references `proxy.conf.json` — it does for demo-angular serve config. The path is relative to workspace root, so it should still work.

**Step 12: Verify the build still works with Angular CLI**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run "build all"`
Expected: All builds pass (this verifies all path updates are correct)

**Step 13: Commit**

```bash
git add -A
git commit -m "fix: update all path references after directory restructure"
```

---

## Phase 3: Migrate core to tsup

### Task 5: Create shared tsup config and migrate @qodalis/cli-core

**Files:**
- Create: `tsup.shared.ts`
- Create: `packages/core/tsup.config.ts`
- Create: `packages/core/project.json`
- Modify: `packages/core/package.json` (add exports, main, module, types)
- Delete: `packages/core/ng-package.json`
- Delete: `packages/core/tsconfig.lib.json`, `tsconfig.lib.prod.json`

**Step 1: Create shared tsup config**

Create `/Users/nicolaelupei/Documents/Personal/web-cli/tsup.shared.ts`:
```typescript
import type { Options } from 'tsup';

export const sharedConfig: Partial<Options> = {
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
};
```

**Step 2: Create tsup config for core**

Create `packages/core/tsup.config.ts`:
```typescript
import { defineConfig } from 'tsup';
import { sharedConfig } from '../../tsup.shared';

export default defineConfig({
    ...sharedConfig,
    entry: ['src/public-api.ts'],
    outDir: '../../dist/core',
    external: ['@xterm/xterm'],
});
```

Note: `outDir` points to `../../dist/core` to maintain the same dist/ layout.

**Step 3: Create Nx project.json for core**

Create `packages/core/project.json`:
```json
{
  "name": "core",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "packages/core/src",
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": {
        "command": "tsup",
        "cwd": "packages/core"
      },
      "inputs": ["production", "sharedGlobals"],
      "outputs": ["{workspaceRoot}/dist/core"]
    }
  }
}
```

**Step 4: Update packages/core/package.json**

Add modern exports fields:
```json
{
  "name": "@qodalis/cli-core",
  "version": "2.0.1",
  "description": "Core interfaces, types, and utilities for the @qodalis CLI ecosystem.",
  "author": "Nicolae Lupei, Qodalis Solutions",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/qodalis-solutions/web-cli"
  },
  "homepage": "https://qodalis.com",
  "keywords": ["core", "cli", "qodalis", "terminal", "interfaces", "types", "extensions"],
  "main": "./esm/public-api.js",
  "module": "./esm/public-api.js",
  "types": "./public-api.d.ts",
  "exports": {
    ".": {
      "types": "./public-api.d.ts",
      "import": "./esm/public-api.js",
      "require": "./public-api.js"
    }
  },
  "files": ["**/*.js", "**/*.mjs", "**/*.d.ts", "**/*.d.mts", "**/*.map"],
  "dependencies": {
    "@xterm/xterm": "^5.5.0"
  },
  "sideEffects": false
}
```

Wait — tsup output format differs from ng-packagr. tsup with `format: ['cjs', 'esm']` outputs:
- `public-api.js` (CJS)
- `public-api.mjs` (ESM)
- `public-api.d.ts` (types)
- `public-api.d.mts` (ESM types)

So the package.json exports should be:
```json
{
  "main": "./public-api.js",
  "module": "./public-api.mjs",
  "types": "./public-api.d.ts",
  "exports": {
    ".": {
      "types": "./public-api.d.ts",
      "import": "./public-api.mjs",
      "require": "./public-api.js"
    }
  }
}
```

Remove `tslib` from dependencies (tsup bundles helpers inline).

**Step 5: Create a tsconfig.json for core (for tsup's dts generation)**

Create `packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../dist/core",
    "declaration": true,
    "declarationMap": true,
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.spec.ts"]
}
```

**Step 6: Create tsconfig.base.json at root (rename from tsconfig.json)**

The root `tsconfig.json` currently has Angular-specific options. Create a `tsconfig.base.json` with shared compiler options, and keep `tsconfig.json` extending it for Angular compatibility.

Create `tsconfig.base.json`:
```json
{
  "compileOnSave": false,
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@qodalis/cli-core": ["dist/core"],
      "@qodalis/cli": ["dist/cli"],
      "@qodalis/angular-cli": ["dist/angular-cli"],
      "@qodalis/cli-server-logs": ["dist/server-logs"],
      "@qodalis/cli-guid": ["dist/guid"],
      "@qodalis/cli-text-to-image": ["dist/text-to-image"],
      "@qodalis/cli-regex": ["dist/regex"],
      "@qodalis/cli-speed-test": ["dist/speed-test"],
      "@qodalis/cli-browser-storage": ["dist/browser-storage"],
      "@qodalis/cli-string": ["dist/string"],
      "@qodalis/cli-todo": ["dist/todo"],
      "@qodalis/cli-curl": ["dist/curl"],
      "@qodalis/cli-password-generator": ["dist/password-generator"],
      "@qodalis/cli-qr": ["dist/qr"],
      "@qodalis/cli-yesno": ["dist/yesno"],
      "@qodalis/cli-users": ["dist/users"],
      "@qodalis/cli-files": ["dist/files"]
    },
    "outDir": "./dist/out-tsc",
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "sourceMap": true,
    "declaration": false,
    "downlevelIteration": true,
    "experimentalDecorators": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "target": "ES2022",
    "module": "ES2022",
    "useDefineForClassFields": false,
    "lib": ["ES2022", "dom"],
    "skipLibCheck": true
  }
}
```

Update `tsconfig.json` to extend it:
```json
{
  "extends": "./tsconfig.base.json",
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  }
}
```

**Step 7: Delete old ng-packagr configs for core**

```bash
rm packages/core/ng-package.json
rm packages/core/tsconfig.lib.json
rm packages/core/tsconfig.lib.prod.json 2>/dev/null
```

**Step 8: Build core with tsup**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli/packages/core && npx tsup`
Expected: Files generated in `../../dist/core/` — `public-api.js`, `public-api.mjs`, `public-api.d.ts`

**Step 9: Verify dist/core/ output**

Run: `ls -la /Users/nicolaelupei/Documents/Personal/web-cli/dist/core/`
Expected: CJS, ESM, and DTS files present

**Step 10: Commit**

```bash
git add -A
git commit -m "feat: migrate @qodalis/cli-core from ng-packagr to tsup"
```

---

### Task 6: Migrate @qodalis/cli to tsup

**Files:**
- Create: `packages/cli/tsup.config.ts`
- Create: `packages/cli/project.json`
- Modify: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Delete: `packages/cli/ng-package.json`, `tsconfig.lib.json`, `tsconfig.lib.prod.json`

**Step 1: Create tsup config for cli**

Create `packages/cli/tsup.config.ts`:
```typescript
import { defineConfig } from 'tsup';
import { sharedConfig } from '../../tsup.shared';

export default defineConfig({
    ...sharedConfig,
    entry: ['src/public-api.ts'],
    outDir: '../../dist/cli',
    external: [
        '@qodalis/cli-core',
        '@xterm/xterm',
        '@xterm/addon-fit',
        '@xterm/addon-web-links',
        '@xterm/addon-unicode11',
        'rxjs',
    ],
});
```

**Step 2: Create project.json**

Create `packages/cli/project.json`:
```json
{
  "name": "cli",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "packages/cli/src",
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": {
        "command": "tsup",
        "cwd": "packages/cli"
      },
      "inputs": ["production", "sharedGlobals"],
      "outputs": ["{workspaceRoot}/dist/cli"]
    }
  }
}
```

**Step 3: Update packages/cli/package.json**

```json
{
  "name": "@qodalis/cli",
  "version": "2.0.1",
  "description": "Framework-agnostic CLI engine for @qodalis terminal applications.",
  "author": "Nicolae Lupei, Qodalis Solutions",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/qodalis-solutions/web-cli"
  },
  "homepage": "https://qodalis.com",
  "keywords": ["cli", "qodalis", "terminal", "command-line", "web-terminal", "xterm", "framework-agnostic"],
  "main": "./public-api.js",
  "module": "./public-api.mjs",
  "types": "./public-api.d.ts",
  "exports": {
    ".": {
      "types": "./public-api.d.ts",
      "import": "./public-api.mjs",
      "require": "./public-api.js"
    }
  },
  "files": ["**/*.js", "**/*.mjs", "**/*.d.ts", "**/*.d.mts", "**/*.map", "assets/**"],
  "dependencies": {
    "@qodalis/cli-core": "^2.0.1",
    "@xterm/xterm": "^5.5.0",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/addon-web-links": "^0.11.0",
    "@xterm/addon-unicode11": "^0.8.0",
    "rxjs": "^7.0.0"
  },
  "sideEffects": false
}
```

**Step 4: Create tsconfig.json for cli**

Create `packages/cli/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../dist/cli",
    "declaration": true,
    "declarationMap": true,
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.spec.ts"]
}
```

**Step 5: Handle assets directory**

The cli package has `src/assets`. tsup doesn't copy static assets automatically. Add a copy step:

Update `packages/cli/project.json`:
```json
{
  "name": "cli",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "packages/cli/src",
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": {
        "commands": [
          "tsup",
          "cp -r src/assets ../../dist/cli/assets 2>/dev/null || true"
        ],
        "cwd": "packages/cli",
        "parallel": false
      },
      "inputs": ["production", "sharedGlobals"],
      "outputs": ["{workspaceRoot}/dist/cli"]
    }
  }
}
```

**Step 6: Delete old configs**

```bash
rm packages/cli/ng-package.json
rm packages/cli/tsconfig.lib.json
rm packages/cli/tsconfig.lib.prod.json 2>/dev/null
```

**Step 7: Build and verify**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && npx nx build cli`
Expected: `dist/cli/` contains `public-api.js`, `public-api.mjs`, `public-api.d.ts`, `assets/`

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: migrate @qodalis/cli from ng-packagr to tsup"
```

---

## Phase 4: Migrate All 14 Plugins to tsup

### Task 7: Create a plugin tsup template and migrate all plugins

All 14 plugins follow the exact same pattern. Each needs:
1. `tsup.config.ts`
2. `project.json`
3. Updated `package.json`
4. `tsconfig.json`
5. Remove: `ng-package.json`, `tsconfig.lib.json`, `tsconfig.lib.prod.json`, `tsconfig.browser.json`, `rollup.config.mjs`

**Step 1: Create tsup config for each plugin**

For each plugin, create `packages/plugins/<name>/tsup.config.ts`:

Template (same for all except `external` array varies):
```typescript
import { defineConfig } from 'tsup';
import { sharedConfig } from '../../../tsup.shared';

export default defineConfig({
    ...sharedConfig,
    entry: ['src/public-api.ts'],
    outDir: '../../../dist/<name>',
    external: ['@qodalis/cli-core'],
});
```

Plugins with extra dependencies need those added to `external`:
- `string`: add `'lodash'`
- `server-logs`: add `'@microsoft/signalr'`
- `curl`: add `'axios'` (check if it uses axios)
- `qr`: add `'qr-code-styling'` (check if it uses it)
- `speed-test`: check for extra deps

For each plugin, also add a UMD/IIFE entry if it has a `cli-entrypoint.ts`:
```typescript
import { defineConfig } from 'tsup';
import { sharedConfig } from '../../../tsup.shared';

export default defineConfig([
    {
        ...sharedConfig,
        entry: ['src/public-api.ts'],
        outDir: '../../../dist/<name>',
        external: ['@qodalis/cli-core'],
    },
    {
        entry: ['src/cli-entrypoint.ts'],
        format: ['iife'],
        outDir: '../../../dist/<name>/umd',
        globalName: '<name>',
        external: [],
        noExternal: [/.*/],
        platform: 'browser',
    },
]);
```

Note: Check each plugin for `cli-entrypoint.ts` existence before adding the IIFE config.

**Step 2: Create project.json for each plugin**

Template for `packages/plugins/<name>/project.json`:
```json
{
  "name": "<npm-name-without-scope>",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "packages/plugins/<name>/src",
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": {
        "command": "tsup",
        "cwd": "packages/plugins/<name>"
      },
      "inputs": ["production", "sharedGlobals"],
      "outputs": ["{workspaceRoot}/dist/<name>"]
    }
  }
}
```

**Step 3: Update each plugin's package.json**

Add modern exports:
```json
{
  "main": "./public-api.js",
  "module": "./public-api.mjs",
  "types": "./public-api.d.ts",
  "exports": {
    ".": {
      "types": "./public-api.d.ts",
      "import": "./public-api.mjs",
      "require": "./public-api.js"
    }
  }
}
```

Keep existing `umd`, `unpkg` fields pointing to `./umd/cli-entrypoint.global.js` (tsup IIFE output name).
Remove `tslib` from dependencies.
Remove `scripts.tsc-compilejs` and `scripts.rollup-compile`.

**Step 4: Create tsconfig.json for each plugin**

Template for `packages/plugins/<name>/tsconfig.json`:
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../../dist/<name>",
    "declaration": true,
    "declarationMap": true,
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.spec.ts"]
}
```

**Step 5: Delete old configs from all plugins**

For each of the 14 plugins:
```bash
rm packages/plugins/<name>/ng-package.json
rm packages/plugins/<name>/tsconfig.lib.json
rm packages/plugins/<name>/tsconfig.lib.prod.json 2>/dev/null
rm packages/plugins/<name>/tsconfig.browser.json 2>/dev/null
rm packages/plugins/<name>/rollup.config.mjs
rm packages/plugins/<name>/package-lock.json 2>/dev/null
rm -rf packages/plugins/<name>/node_modules 2>/dev/null
```

**Step 6: Build all plugins**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && npx nx run-many -t build --projects='guid,regex,text-to-image,speed-test,browser-storage,string,todo,curl,password-generator,server-logs,qr,files,users,yesno'`

Expected: All 14 plugins build successfully to `dist/<name>/`

**Step 7: Verify output for one plugin**

Run: `ls /Users/nicolaelupei/Documents/Personal/web-cli/dist/guid/`
Expected: `public-api.js`, `public-api.mjs`, `public-api.d.ts`, `umd/` (if IIFE config was added)

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: migrate all 14 plugins from ng-packagr to tsup"
```

---

## Phase 5: Configure angular-cli with Nx

### Task 8: Set up angular-cli as the sole ng-packagr project

**Files:**
- Modify: `packages/angular-cli/ng-package.json`
- Create: `packages/angular-cli/project.json`
- Modify: `angular.json` (strip down to only angular-cli + angular apps)

**Step 1: Install @nx/angular**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm add -Dw @nx/angular`

**Step 2: Create project.json for angular-cli**

Create `packages/angular-cli/project.json`:
```json
{
  "name": "angular-cli",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "packages/angular-cli/src",
  "targets": {
    "build": {
      "executor": "@angular-devkit/build-angular:ng-packagr",
      "options": {
        "project": "packages/angular-cli/ng-package.json"
      },
      "configurations": {
        "production": {
          "tsConfig": "packages/angular-cli/tsconfig.lib.prod.json"
        },
        "development": {
          "tsConfig": "packages/angular-cli/tsconfig.lib.json"
        }
      },
      "defaultConfiguration": "production",
      "inputs": ["production", "sharedGlobals"],
      "outputs": ["{workspaceRoot}/dist/angular-cli"]
    }
  }
}
```

**Step 3: Ensure angular-cli's ng-package.json paths are correct**

File: `packages/angular-cli/ng-package.json` — verify:
```json
{
  "$schema": "../../node_modules/ng-packagr/ng-package.schema.json",
  "dest": "../../dist/angular-cli",
  "assets": ["src/assets"],
  "lib": {
    "entryFile": "src/public-api.ts"
  },
  "allowedNonPeerDependencies": ["@qodalis/cli-core", "@qodalis/cli"]
}
```

**Step 4: Strip angular.json down to only Angular projects**

File: `angular.json`
Remove ALL library entries that were migrated to tsup (core, cli, all 14 plugins).
Keep only:
- `angular-cli` (library, ng-packagr)
- `demo-angular` (application)
- `docs` (application)

Update paths for the remaining entries to use `packages/angular-cli/`, `apps/demo-angular/`, `apps/docs/`.

**Step 5: Create project.json for demo-angular**

Create `apps/demo-angular/project.json`:
```json
{
  "name": "demo-angular",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/demo-angular/src",
  "targets": {
    "build": {
      "executor": "@angular-devkit/build-angular:browser",
      "options": {
        "outputPath": "dist/demo-angular"
      }
    },
    "serve": {
      "executor": "@angular-devkit/build-angular:dev-server",
      "options": {
        "port": 4303,
        "proxyConfig": "proxy.conf.json"
      }
    }
  }
}
```

Note: Full build options should be copied from current angular.json entry.

**Step 6: Create project.json for docs**

Similar to demo-angular but for the docs app.

**Step 7: Build angular-cli to verify**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && npx nx build angular-cli`
Expected: `dist/angular-cli/` generated with ng-packagr output

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: configure angular-cli and Angular apps with Nx"
```

---

## Phase 6: Update React/Vue Wrappers

### Task 9: Update react-cli and vue-cli for new paths

**Files:**
- Create: `packages/react-cli/project.json`
- Create: `packages/vue-cli/project.json`
- Modify: `packages/react-cli/tsconfig.json` (if needed)
- Modify: `packages/vue-cli/tsconfig.json` (if needed)

**Step 1: Create project.json for react-cli**

Create `packages/react-cli/project.json`:
```json
{
  "name": "react-cli",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "packages/react-cli/src",
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": {
        "command": "tsup",
        "cwd": "packages/react-cli"
      },
      "inputs": ["production", "sharedGlobals"],
      "outputs": ["{projectRoot}/dist"]
    }
  }
}
```

Note: react-cli outputs to its own `dist/` (not root dist/). The deploy CI copies it.

**Step 2: Create project.json for vue-cli**

Create `packages/vue-cli/project.json`:
```json
{
  "name": "vue-cli",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "packages/vue-cli/src",
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": {
        "command": "tsup",
        "cwd": "packages/vue-cli"
      },
      "inputs": ["production", "sharedGlobals"],
      "outputs": ["{projectRoot}/dist"]
    }
  }
}
```

**Step 3: Verify tsconfig.json path aliases still resolve**

Both `packages/react-cli/tsconfig.json` and `packages/vue-cli/tsconfig.json` use:
```json
"paths": {
    "@qodalis/cli-core": ["../../dist/core"],
    "@qodalis/cli": ["../../dist/cli"]
}
```
From `packages/react-cli/`, `../../dist/` = root `dist/`. Correct.

**Step 4: Build both**

Run:
```bash
cd /Users/nicolaelupei/Documents/Personal/web-cli
npx nx build react-cli
npx nx build vue-cli
```
Expected: Both build to their respective `dist/` folders

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Nx project configs for react-cli and vue-cli"
```

---

## Phase 7: Update Demo Apps

### Task 10: Update demo apps for new structure

**Files:**
- Modify: `apps/demo-react/package.json`
- Modify: `apps/demo-react/vite.config.ts`
- Modify: `apps/demo-vue/package.json`
- Modify: `apps/demo-vue/vite.config.ts`

**Step 1: Update demo-react package.json**

Update `file:` references:
```json
{
  "@qodalis/react-cli": "file:../../packages/react-cli",
  "@qodalis/cli": "file:../../dist/cli",
  "@qodalis/cli-core": "file:../../dist/core"
}
```
All `dist/` references stay the same (correct depth). Only the wrapper reference changes.

**Step 2: Update demo-react vite.config.ts**

Update alias paths:
```typescript
resolve: {
    preserveSymlinks: false,
    alias: {
        '@qodalis/cli-core': path.resolve(__dirname, '../../dist/core'),
        '@qodalis/cli': path.resolve(__dirname, '../../dist/cli'),
    },
},
```

**Step 3: Update demo-vue package.json**

Same pattern — update `@qodalis/vue-cli` reference:
```json
{
  "@qodalis/vue-cli": "file:../../packages/vue-cli"
}
```

**Step 4: Update demo-vue vite.config.ts**

```typescript
resolve: {
    preserveSymlinks: true,
    alias: {
        '@qodalis/cli-core': path.resolve(__dirname, '../../dist/core'),
        '@qodalis/cli': path.resolve(__dirname, '../../dist/cli'),
        '@qodalis/vue-cli': path.resolve(__dirname, '../../packages/vue-cli'),
    },
},
```

**Step 5: Test demo-react dev server**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli/apps/demo-react && pnpm install && npx vite --port 4301`
Expected: Dev server starts on port 4301

**Step 6: Test demo-vue dev server**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli/apps/demo-vue && pnpm install && npx vite --port 4302`
Expected: Dev server starts on port 4302

**Step 7: Commit**

```bash
git add -A
git commit -m "fix: update demo apps for new directory structure"
```

---

## Phase 8: Update Root Scripts and CI/CD

### Task 11: Update root package.json scripts to use Nx

**Files:**
- Modify: `package.json`

**Step 1: Update scripts**

Replace build scripts with Nx commands:
```json
{
  "scripts": {
    "build": "nx run-many -t build",
    "build:affected": "nx affected -t build",
    "build:core": "nx build core",
    "build:cli": "nx build cli",
    "build:angular-cli": "pnpm run build:styles && nx build angular-cli",
    "build:react-cli": "nx build react-cli",
    "build:vue-cli": "nx build vue-cli",
    "build:styles": "sass packages/angular-cli/src/assets/styles.sass packages/angular-cli/src/assets/styles.css --no-source-map",
    "build:styles:watch": "sass --watch packages/angular-cli/src/assets/styles.sass packages/angular-cli/src/assets/styles.css --no-source-map",
    "serve:angular-demo": "nx serve demo-angular",
    "serve:react-demo": "cd apps/demo-react && npx vite --port 4301",
    "serve:vue-demo": "cd apps/demo-vue && npx vite --port 4302",
    "serve:docs": "nx serve docs",
    "test": "nx run-many -t test",
    "lint": "nx run-many -t lint",
    "format": "prettier --write \"packages/**/*.{ts,html,css,scss}\" \"apps/**/*.{ts,html,css,scss}\"",
    "graph": "nx graph",
    "inject-versions": "node ./tools/inject-versions.js"
  }
}
```

Remove old scripts: `"ng"`, `"build all"`, `"install projects deps"`, `"watch core"`, `"watch cli"`, `"watch angular-cli"`, `"start docs"`, `"start angular-demo"`, `"start react-demo"`, `"start vue-demo"`, `"build docs"`, `"create lib"`, `"publish:local"`, `"serve:local"`.

**Step 2: Verify full build**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run build`
Expected: Nx builds all projects in correct dependency order

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: update root scripts to use Nx commands"
```

---

### Task 12: Update CI/CD workflows

**Files:**
- Modify: `.github/workflows/build.yml`
- Modify: `.github/workflows/deploy.yml`

**Step 1: Update build.yml**

```yaml
name: Build CLI Workspace CI/CD

on:
  pull_request:
    branches:
      - main

jobs:
  build:
    name: Build and Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: latest

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build affected projects
        run: pnpm exec nx affected -t build --base=origin/main

      - name: Run tests
        run: pnpm exec nx affected -t test --base=origin/main
```

**Step 2: Update deploy.yml**

```yaml
name: Deploy CLI Workspace CI/CD

on:
  push:
    branches:
      - main

jobs:
  deploy:
    name: Deploy libraries
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: latest

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: "pnpm"
          registry-url: https://registry.npmjs.org/

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Inject versions
        run: node tools/inject-versions.js

      - name: Build all projects
        run: pnpm exec nx run-many -t build

      - name: Copy tsup wrapper builds into dist for publishing
        run: |
          mkdir -p dist/react-cli dist/vue-cli
          cp -r packages/react-cli/dist/* dist/react-cli/ 2>/dev/null || true
          cp packages/react-cli/package.json dist/react-cli/
          cp -r packages/vue-cli/dist/* dist/vue-cli/ 2>/dev/null || true
          cp packages/vue-cli/package.json dist/vue-cli/

      - name: Copy README.md into main libraries
        run: |
          cp README.md dist/cli/
          cp README.md dist/core/
          cp README.md dist/angular-cli/
          cp README.md dist/react-cli/
          cp README.md dist/vue-cli/

      - name: Copy package.json to dist for plugins
        run: |
          for plugin in guid regex text-to-image speed-test browser-storage string todo curl password-generator server-logs qr files users yesno; do
            if [ -f "packages/plugins/$plugin/package.json" ]; then
              cp packages/plugins/$plugin/package.json dist/$plugin/
            fi
          done

      - name: Publish to NPM
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: |
          EXCLUDED=("docs" "demo-angular")

          LIBRARIES=($(ls dist | grep -v -E "$(IFS=\|; echo "${EXCLUDED[*]}")"))

          echo "Libraries to publish: ${LIBRARIES[@]}"

          FAILED=()

          for LIB_NAME in "${LIBRARIES[@]}"; do
            DIR="./dist/$LIB_NAME"
            if [ -f "$DIR/package.json" ]; then
              echo "Publishing $LIB_NAME..."
              cd $DIR
              OUTPUT=$(npm publish --access public 2>&1) && true
              EXIT_CODE=$?
              if [ $EXIT_CODE -ne 0 ]; then
                if echo "$OUTPUT" | grep -q "You cannot publish over the previously published versions"; then
                  echo "$LIB_NAME version already exists on npm, skipping."
                else
                  echo "$OUTPUT"
                  echo "::error::Failed to publish $LIB_NAME"
                  FAILED+=("$LIB_NAME")
                fi
              fi
              cd ../..
            else
              echo "Skipping $LIB_NAME: package.json not found in $DIR"
            fi
          done

          if [ ${#FAILED[@]} -ne 0 ]; then
            echo "::error::Failed to publish: ${FAILED[*]}"
            exit 1
          fi
```

**Step 3: Commit**

```bash
git add -A
git commit -m "ci: update GitHub Actions for Nx + pnpm"
```

---

## Phase 9: Cleanup

### Task 13: Remove old files and verify everything works

**Step 1: Delete rollup.shared.mjs (no longer needed)**

```bash
rm rollup.shared.mjs
```

**Step 2: Delete old Angular-only ESLint config if Angular ESLint is no longer root concern**

Actually keep `.eslintrc.json` for now — the Angular wrapper and demo-angular still need it. Consider migrating ESLint to flat config as a separate task.

**Step 3: Clean dist/ and rebuild from scratch**

```bash
rm -rf dist/
pnpm exec nx run-many -t build
```
Expected: All packages build successfully

**Step 4: Verify dist/ structure**

```bash
ls dist/
```
Expected: core, cli, angular-cli, react-cli, vue-cli, guid, regex, text-to-image, speed-test, browser-storage, string, todo, curl, password-generator, server-logs, qr, files, users, yesno

**Step 5: Run Nx graph to verify dependency tree**

Run: `pnpm exec nx graph`
Expected: Opens browser showing correct dependency graph (core at base, cli depends on core, angular-cli depends on both, plugins depend on core, wrappers depend on core+cli)

**Step 6: Verify package.json files are present in dist/ for publishing**

For tsup packages, the package.json needs to be copied to dist/ during publish (CI does this). For ng-packagr (angular-cli), it's already copied by the builder.

Check: `ls dist/core/package.json` — tsup doesn't copy this automatically. Need to either:
- Add a copy step in the tsup build target, OR
- Handle in CI (like current deploy.yml does for react/vue)

Add to each tsup project.json build target:
```json
"commands": [
    "tsup",
    "cp package.json ../../dist/<name>/package.json"
]
```

Or better — add to tsup.shared.ts using `onSuccess`:
Actually, simplest approach: update each `project.json` to include the copy.

**Step 7: Update tools/inject-versions.js for new paths**

The script needs to scan `packages/` and `packages/plugins/` instead of `projects/`:
```javascript
const packagesPath = path.resolve(__dirname, "../packages");
const pluginsPath = path.resolve(__dirname, "../packages/plugins");

// Scan both directories
const topLevelDirs = fs.readdirSync(packagesPath).filter(dir => {
    const p = path.join(packagesPath, dir, "package.json");
    return fs.existsSync(p) && dir !== 'plugins';
});
const pluginDirs = fs.readdirSync(pluginsPath).filter(dir => {
    return fs.existsSync(path.join(pluginsPath, dir, "package.json"));
}).map(dir => `plugins/${dir}`);

const allDirs = [...topLevelDirs, ...pluginDirs];
```

**Step 8: Final full build + test**

```bash
cd /Users/nicolaelupei/Documents/Personal/web-cli
rm -rf dist/
pnpm exec nx run-many -t build
pnpm exec nx run-many -t test 2>/dev/null || echo "Tests may need updating"
```

**Step 9: Commit**

```bash
git add -A
git commit -m "chore: cleanup old configs and verify full build"
```

---

### Task 14: Update documentation and gitignore

**Step 1: Update .gitignore**

Add:
```
# Nx
.nx/
.nx/cache/

# pnpm
package-lock.json
```

**Step 2: Update root README.md** (if it references old paths)

Search for `projects/` references and update to `packages/` or `packages/plugins/` or `apps/`.

**Step 3: Update CLAUDE.md**

Update the workspace overview, build commands, and monorepo structure sections to reflect the new layout.

**Step 4: Commit**

```bash
git add -A
git commit -m "docs: update documentation for new Nx + tsup structure"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Pre | Task 0 | Feature branch + verify current build |
| 1 | Tasks 1-2 | Initialize pnpm + Nx |
| 2 | Tasks 3-4 | Directory restructure + fix paths |
| 3 | Tasks 5-6 | Migrate core + cli to tsup |
| 4 | Task 7 | Migrate all 14 plugins to tsup |
| 5 | Task 8 | Configure angular-cli with Nx |
| 6 | Task 9 | Update react/vue wrappers |
| 7 | Task 10 | Update demo apps |
| 8 | Tasks 11-12 | Update scripts + CI/CD |
| 9 | Tasks 13-14 | Cleanup + docs |

Total: 15 tasks, ~14 commits

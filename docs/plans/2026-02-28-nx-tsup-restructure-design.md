# Nx + tsup Monorepo Restructure

**Date:** 2026-02-28
**Status:** Approved

## Problem

The web-cli monorepo is an Angular CLI workspace (`angular.json`). Even though `core`, `cli`, and all 14 plugins are framework-agnostic TypeScript, they're built with ng-packagr (Angular's library bundler). This means:

- Contributors need the full Angular toolchain even for React/Vue work
- Build orchestration relies on custom Node.js scripts (`build-all.js`)
- No build caching — every build rebuilds everything
- Angular is the "host" rather than an equal peer alongside React and Vue
- The flat `projects/` directory mixes 14 plugins, 3 core libs, 2 framework wrappers, and 4 apps

## Solution

Migrate to **Nx workspace** with **pnpm** and **tsup** as the primary build tool. Angular becomes one wrapper among equals.

## New Directory Layout

```
web-cli/
├── nx.json
├── pnpm-workspace.yaml
├── package.json                       # Root: devDeps only
├── tsconfig.base.json
├── tsup.shared.ts
│
├── packages/
│   ├── core/                          # @qodalis/cli-core — tsup
│   ├── cli/                           # @qodalis/cli — tsup
│   ├── angular-cli/                   # @qodalis/angular-cli — ng-packagr (only Angular package)
│   ├── react-cli/                     # @qodalis/react-cli — tsup
│   ├── vue-cli/                       # @qodalis/vue-cli — tsup
│   └── plugins/
│       ├── guid/                      # @qodalis/cli-guid — tsup
│       ├── regex/
│       ├── string/
│       ├── todo/
│       ├── curl/
│       ├── qr/
│       ├── files/
│       ├── users/
│       ├── yesno/
│       ├── password-generator/
│       ├── browser-storage/
│       ├── speed-test/
│       ├── text-to-image/
│       └── server-logs/
│
├── apps/
│   ├── demo-angular/
│   ├── demo-react/
│   ├── demo-vue/
│   └── docs/
│
└── tools/
    ├── inject-versions.js
    └── create-library.js
```

## Build System Changes

| Package | Before | After |
|---------|--------|-------|
| `core` | ng-packagr | tsup (CJS + ESM + DTS) |
| `cli` | ng-packagr | tsup (CJS + ESM + DTS) |
| 14 plugins | ng-packagr + Rollup UMD | tsup (CJS + ESM + DTS + optional UMD via `globalName`) |
| `angular-cli` | ng-packagr | ng-packagr (unchanged) |
| `react-cli` | tsup | tsup (unchanged) |
| `vue-cli` | tsup | tsup (unchanged) |

### Shared tsup config

```typescript
// tsup.shared.ts
import { Options } from 'tsup';

export const sharedConfig: Options = {
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
};
```

### Plugin tsup config

```typescript
// packages/plugins/guid/tsup.config.ts
import { defineConfig } from 'tsup';
import { sharedConfig } from '../../../tsup.shared';

export default defineConfig({
    ...sharedConfig,
    entry: ['src/public-api.ts'],
    external: ['@qodalis/cli-core'],
});
```

## Nx Configuration

### nx.json

- `targetDefaults` for `build`, `test`, `lint`
- `build` depends on `^build` (build dependencies first) — replaces `build-all.js`
- Remote caching optional (Nx Cloud)

### Per-package project.json (tsup packages)

```json
{
  "name": "core",
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": { "command": "tsup", "cwd": "packages/core" },
      "dependsOn": ["^build"]
    }
  }
}
```

### Angular-cli project.json

```json
{
  "name": "angular-cli",
  "targets": {
    "build": {
      "executor": "@nx/angular:package",
      "options": { "project": "packages/angular-cli/ng-package.json" },
      "dependsOn": ["^build"]
    }
  }
}
```

### Key commands replacing custom scripts

| Before | After |
|--------|-------|
| `npm run "build all"` (scripts/build-all.js) | `nx run-many -t build` |
| `npm run "install projects deps"` | `pnpm install` |
| `ng build core` | `nx build core` |
| `ng serve demo-angular` | `nx serve demo-angular` |
| CI full rebuild | `nx affected -t build` (only changed packages) |

## Dependency Management (pnpm)

- `pnpm-workspace.yaml` defines workspace packages
- Internal deps use `workspace:*` protocol (e.g., `"@qodalis/cli-core": "workspace:*"`)
- Strict hoisting prevents phantom dependencies
- Single `pnpm install` replaces `install-projects-deps.js`

## What Gets Deleted

- `angular.json` (replaced by `nx.json` + per-package `project.json`)
- `scripts/build-all.js` (replaced by `nx run-many`)
- `scripts/install-projects-deps.js` (replaced by `pnpm install`)
- `rollup.shared.mjs` + all `rollup.config.mjs` in plugins
- All `ng-package.json` files except `angular-cli`'s
- `package-lock.json` (replaced by `pnpm-lock.yaml`)

## What Stays the Same

- All source code (`.ts` files) — core/cli/plugins are already framework-agnostic
- `angular-cli` build pipeline (ng-packagr)
- npm package names
- Published output format (CJS + ESM + DTS)
- UMD output for plugins (tsup `globalName`)
- Demo apps and docs site (just relocated to `apps/`)

## Migration Order

1. Initialize Nx + pnpm at root
2. Move directories: `projects/` → `packages/` + `apps/`
3. Migrate core: ng-packagr → tsup
4. Migrate cli: ng-packagr → tsup
5. Migrate plugins: All 14 to tsup (batch)
6. Update angular-cli: Point to Nx Angular executor
7. Update react-cli/vue-cli: Update paths
8. Update apps: Point to new package locations
9. Update CI/CD: Replace build commands with Nx
10. Cleanup: Remove old configs, scripts, verify all builds + tests pass

## Risk Mitigation

- **Breaking change for consumers:** None — npm package names and exports unchanged
- **UMD output:** tsup supports IIFE output with `globalName` for browser script tag usage
- **Angular-cli compatibility:** Stays on ng-packagr, only path references change
- **Rollback:** Git branch — can revert entirely if needed

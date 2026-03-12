# Developer Guide

This guide covers everything you need to get started developing on the Qodalis Web CLI monorepo.

## Prerequisites

- **Node.js 22+** (used in CI; `@types/node` targets 22)
- **pnpm** (latest version — install via `corepack enable && corepack prepare pnpm@latest --activate` or `npm i -g pnpm`)
- **Chrome/Chromium** (required for running tests in headless mode)
- **Git** (for version control and submodule management)

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/qodalis-solutions/web-cli.git
cd web-cli

# 2. Install dependencies
pnpm install

# 3. Build all packages (required before running demos)
pnpm run build

# 4. Start a demo app
pnpm run serve:angular-demo   # http://localhost:4303
pnpm run serve:react-demo     # http://localhost:4301
pnpm run serve:vue-demo       # http://localhost:4302
```

> **Important:** You must build all packages before serving any demo app, because inter-package dependencies resolve from `dist/` via path aliases in `tsconfig.base.json`.

## Project Structure

```
web-cli/
  packages/
    core/                  # @qodalis/cli-core — shared types, interfaces, utilities
    cli/                   # @qodalis/cli — framework-agnostic CLI engine
    angular-cli/           # @qodalis/angular-cli — Angular wrapper components
    react-cli/             # @qodalis/react-cli — React wrapper
    vue-cli/               # @qodalis/vue-cli — Vue 3 wrapper
    create-cli-plugin/     # @qodalis/create-cli-plugin — plugin scaffolding tool
    plugins/               # 21 CLI plugins (guid, regex, snake, tetris, etc.)
  apps/
    demo-angular/          # Angular demo app
    demo-react/            # React demo app (Vite)
    demo-vue/              # Vue demo app (Vite)
    docs/                  # Documentation site (Angular)
```

**Build order** is managed by Nx via `dependsOn: ["^build"]`:

```
core -> cli -> angular-cli -> plugins -> framework wrappers -> apps
```

## Common Commands

### Building

```bash
pnpm run build                  # Build all 31 projects
pnpm run build:affected         # Build only changed projects (Nx affected)
pnpm run build:core             # Build core library only
pnpm run build:cli              # Build CLI engine only
pnpm run build:angular-cli      # Build Angular wrapper (compiles SASS first)
pnpm run build:react-cli        # Build React wrapper
pnpm run build:vue-cli          # Build Vue wrapper
```

### Development Servers

```bash
pnpm run serve:angular-demo     # localhost:4303
pnpm run serve:react-demo       # localhost:4301 (Vite)
pnpm run serve:vue-demo         # localhost:4302 (Vite)
pnpm run serve:docs             # localhost:4300
```

### Testing

```bash
pnpm test                       # Run tests across all projects
npx nx test <project-name>      # Run tests for a single project (e.g., nx test guid)
```

Tests use **Jasmine + Karma** with `ChromeHeadless`. All test targets are configured with `"watch": false` so they exit after running.

### Linting & Formatting

```bash
pnpm run lint                   # ESLint all projects
pnpm run format                 # Prettier format all source files
```

### Utilities

```bash
pnpm run inject-versions        # Sync version.ts files from package.json versions
pnpm run graph                  # Open Nx dependency graph in browser
pnpm run build:styles           # Compile SASS for angular-cli
pnpm run build:styles:watch     # Watch mode SASS compilation
```

## Creating a New Plugin

Always use the scaffolding tool — never create plugin directories manually:

```bash
pnpm run create-plugin
```

Or non-interactively:

```bash
pnpm run create-plugin -- --name my-plugin --description "My plugin description" --processor-name MyPlugin
```

This will:
1. Create `packages/plugins/my-plugin/` with all boilerplate
2. Generate the processor class, module, tsup config, project.json, and test file
3. Add the `@qodalis/cli-my-plugin` path alias to `tsconfig.base.json`

### Plugin Structure

Each plugin follows a consistent structure (using `guid` as an example):

```
packages/plugins/guid/
  src/
    cli-entrypoint.ts              # IIFE entry — calls bootCliModule() for standalone browser use
    public-api.ts                  # Library entry — exports processor class + module
    lib/
      processors/
        cli-guid-command-processor.ts   # ICliCommandProcessor implementation
      utilities/
        index.ts                   # Plugin-specific utilities
      version.ts                   # Auto-generated version constant
    tests/
      index.spec.ts                # Jasmine tests
  package.json                     # npm package config with workspace:* dependency on cli-core
  project.json                     # Nx project config (build + test targets)
  tsup.config.ts                   # Build config — produces CJS, ESM, and IIFE (UMD) bundles
  tsconfig.json / tsconfig.spec.json
```

### Implementing a Command Processor

Every command implements `ICliCommandProcessor` from `@qodalis/cli-core`:

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

export class MyCommandProcessor implements ICliCommandProcessor {
    command = 'my-command';
    description = 'What my command does';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;

    // Optional: sub-commands
    processors?: ICliCommandProcessor[] = [];

    // Optional: command parameters
    parameters = [
        {
            name: 'count',
            aliases: ['n'],
            description: 'Number of items',
            defaultValue: '1',
            required: false,
            type: 'number' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const count = command.args['count'] ? parseInt(command.args['count']) : 1;

        context.writer.writeln(`Hello! Count: ${count}`);
        context.process.output({ count });
    }
}
```

### Module Export Pattern

Each plugin exports an `ICliModule`:

```typescript
// public-api.ts
import { ICliModule } from '@qodalis/cli-core';
import { MyCommandProcessor } from './lib/processors/my-command-processor';
import { API_VERSION } from './lib/version';

export const myModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-my-plugin',
    processors: [new MyCommandProcessor()],
};
```

### IIFE Entrypoint for Standalone Browser Use

```typescript
// cli-entrypoint.ts
import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { MyCommandProcessor } from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-my-plugin',
    processors: [new MyCommandProcessor()],
};

bootCliModule(module);
```

### Registering Plugins in an Angular App

```typescript
import { CliModule, resolveCliProviders, resolveCliModuleProvider } from '@qodalis/angular-cli';
import { guidModule } from '@qodalis/cli-guid';
import { myModule } from '@qodalis/cli-my-plugin';

@NgModule({
    imports: [BrowserModule, CliModule],
    providers: [
        resolveCliProviders(),
        resolveCliModuleProvider(guidModule),
        resolveCliModuleProvider(myModule),
    ],
    declarations: [AppComponent],
    bootstrap: [AppComponent],
})
export class AppModule {}
```

## Key Interfaces

| Interface | Location | Description |
|---|---|---|
| `ICliCommandProcessor` | `packages/core/src/lib/interfaces/command-processor.ts` | Command definition: command name, parameters, sub-commands, processCommand handler |
| `ICliExecutionContext` | `packages/core/src/lib/interfaces/execution-context.ts` | Runtime context: writer, input reader, progress bars, state store, clipboard, spinner, abort signal |
| `ICliInputReader` | `packages/core/src/lib/interfaces/input-reader.ts` | Interactive input: readLine, readPassword, readConfirm, readSelect, readMultiSelect, readNumber |
| `ICliModule` | `packages/core/src/lib/interfaces/index.ts` | Module definition: name, processors, lifecycle hooks |

## Build System

Most packages use **tsup** (configured via `tsup.config.ts` per package). Only `angular-cli` uses **ng-packagr**.

Shared tsup config is at `tsup.shared.ts`:

```typescript
export const sharedConfig: Partial<Options> = {
    format: ['cjs', 'esm'],  // Dual CJS + ESM output
    dts: true,                // Type declarations
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
};
```

Each plugin's `tsup.config.ts` produces two builds:
1. **Library build** — CJS + ESM + types (from `public-api.ts`)
2. **IIFE build** — standalone browser bundle (from `cli-entrypoint.ts`) at `dist/<name>/umd/index.js`

## Code Style

Enforced via `.editorconfig`, ESLint, and Prettier:

- **TypeScript files:** 4-space indentation, single quotes, semicolons required
- **Other files:** 2-space indentation
- **Target:** ES2022
- **Strict mode:** enabled (`strict: true` in tsconfig)

Run `pnpm run format` before committing to auto-format.

## Testing

- **Framework:** Jasmine (assertions) + Karma (runner) via `@angular-devkit/build-angular:karma`
- **Browser:** ChromeHeadless (headless, no visible browser)
- **Watch mode:** disabled by default (`"watch": false` in project.json)
- **Test location:** `src/tests/*.spec.ts` within each package

```bash
# Run all tests
pnpm test

# Run tests for a single plugin
npx nx test guid
npx nx test files
npx nx test snake
```

## Working with Nx

This workspace uses **Nx 22** for build orchestration and caching.

```bash
# See the full dependency graph
pnpm run graph

# Build only what changed
pnpm run build:affected

# Run a target on a specific project
npx nx build core
npx nx test guid
npx nx lint cli

# List all projects
npx nx show projects
```

Nx caches build, test, and lint results. If you see stale outputs, clear the cache:

```bash
npx nx reset
```

## CI/CD

Three GitHub Actions workflows:

| Workflow | Trigger | What it does |
|---|---|---|
| `build.yml` | Pull requests to `main` | Installs, builds affected, runs affected tests |
| `deploy.yml` | Push to `main` | Builds all, publishes all packages to npm |
| `deploy-docs.yml` | Push to `main` / manual | Builds all + docs, generates TypeDoc, deploys to GitHub Pages |

All workflows use Node 22 and pnpm.

## Package Management

- **pnpm workspaces** with `workspace:*` protocol for inter-package dependencies
- Workspace packages defined in `pnpm-workspace.yaml`
- Path aliases in `tsconfig.base.json` map `@qodalis/*` to `dist/` folders
- Always run `pnpm install` (not npm) from the workspace root

## WebAssembly (WASM) Acceleration

The CLI engine (`@qodalis/cli`) includes optional WASM modules written in Rust that accelerate text search (nano editor) and tab completion. If WASM is unavailable, the engine falls back to equivalent JavaScript implementations automatically.

### Prerequisites

To build the WASM module locally, you need **Rust** and **wasm-pack** in addition to the standard Node.js toolchain.

#### macOS

```bash
# Install Rust via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
source "$HOME/.cargo/env"

# Add the WASM compilation target
rustup target add wasm32-unknown-unknown

# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

> **Tip:** If you use Homebrew, you can also install Rust via `brew install rust`, but rustup is recommended for managing toolchains and targets.

#### Linux (Ubuntu/Debian)

```bash
# Install build essentials (needed for linking)
sudo apt-get update && sudo apt-get install -y build-essential

# Install Rust via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
source "$HOME/.cargo/env"

# Add the WASM compilation target
rustup target add wasm32-unknown-unknown

# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

For **Fedora/RHEL**:

```bash
sudo dnf groupinstall "Development Tools"
# Then follow the same rustup + wasm-pack steps above
```

For **Arch Linux**:

```bash
sudo pacman -S base-devel
# Then follow the same rustup + wasm-pack steps above
```

#### Windows

**Option A — Native (PowerShell):**

1. Download and run the Rust installer from https://rustup.rs (requires [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/))
2. Open a new terminal after installation, then:

```powershell
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

> **Note:** The `build.sh` script uses bash. On native Windows, run it via Git Bash (included with Git for Windows) or adapt the commands manually: `wasm-pack build --target web --out-dir pkg --release`

**Option B — WSL2 (recommended for Windows):**

```bash
# Inside your WSL2 Ubuntu terminal, follow the Linux steps above
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
source "$HOME/.cargo/env"
rustup target add wasm32-unknown-unknown
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

#### Verify Installation (all platforms)

```bash
rustc --version            # e.g. rustc 1.82.0 (stable)
rustup target list --installed  # Should include wasm32-unknown-unknown
wasm-pack --version        # e.g. wasm-pack 0.13.1
```

### Building WASM

The WASM build is integrated into the CLI package's Nx build target, so `pnpm run build` (or `npx nx build cli`) handles it automatically. To build the WASM module independently:

```bash
cd packages/cli/wasm
chmod +x build.sh
./build.sh               # Runs: wasm-pack build --target web --out-dir pkg --release
```

The compiled binary lands at `packages/cli/wasm/pkg/qodalis_cli_wasm_bg.wasm` and is copied to `dist/cli/wasm/` during the full build.

### WASM Source Structure

```
packages/cli/
  wasm/
    Cargo.toml             # Rust crate config (wasm-bindgen, opt-level "z", LTO)
    src/lib.rs             # Boyer-Moore text search, prefix match, common prefix, replace
    build.sh               # Build script (wasm-pack wrapper)
    pkg/                   # Build output (git-ignored)
  src/lib/wasm/
    types.ts               # ICliWasmAccelerator interface
    fallback.ts            # JsFallbackAccelerator (pure JS fallback)
    wasm-loader.ts         # Async loader + sync accessor (getAccelerator())
    index.ts               # Public exports
```

### How It Works

1. **Startup:** `CliEngine` calls `initWasmAccelerator()` eagerly at boot — silent failure if WASM isn't available.
2. **Runtime:** Code calls `getAccelerator()` synchronously, which returns the WASM accelerator if loaded, or the JS fallback.
3. **Used by:** Nano editor (`searchForward`, `replaceAll`) and tab completion (`prefixMatch`, `commonPrefix`).

### Serving WASM in Consumer Apps

The WASM loader searches for the binary at these paths (in order):

1. `/assets/wasm/qodalis_cli_wasm_bg.wasm`
2. `./assets/wasm/qodalis_cli_wasm_bg.wasm`
3. `/wasm/qodalis_cli_wasm_bg.wasm`

Consumer apps must copy the `.wasm` file from `node_modules/@qodalis/cli/wasm/` to one of these serving paths. In Angular, use the `assets` array in `angular.json` / `project.json`:

```json
{
  "glob": "**/*",
  "input": "dist/cli/wasm",
  "output": "/assets/wasm"
}
```

Alternatively, pass an explicit URL: `initWasmAccelerator('/custom/path/to/file.wasm')`.

### Skipping WASM Build

If you don't have Rust installed and don't need WASM acceleration, the build will fail at the `bash wasm/build.sh` step. You can build the CLI without WASM by running tsup directly:

```bash
cd packages/cli
npx tsup
```

The CLI will work normally using the JavaScript fallback implementations.

## Troubleshooting

### Build fails with "Cannot find module '@qodalis/cli-core'"

You need to build dependencies first. Run `pnpm run build` to build everything, or build in dependency order:

```bash
npx nx build core && npx nx build cli
```

### Tests hang or Chrome processes remain

Kill lingering processes:

```bash
pkill -f "karma|chrome.*headless"
```

### SASS styles not updating

Rebuild styles manually:

```bash
pnpm run build:styles
```

Or use watch mode while developing:

```bash
pnpm run build:styles:watch
```

### Nx cache giving stale results

```bash
npx nx reset
pnpm run build
```

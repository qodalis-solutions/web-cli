# @qodalis/create-cli-plugin

Scaffolds a [Qodalis CLI](https://github.com/qodalis-solutions/web-cli) plugin: a command processor, its `ICliModule`, a browser bundle for `pkg add`, and the build setup.

[![npm](https://img.shields.io/npm/v/@qodalis/create-cli-plugin.svg)](https://www.npmjs.com/package/@qodalis/create-cli-plugin)
[![Build](https://github.com/qodalis-solutions/web-cli/actions/workflows/build.yml/badge.svg?branch=develop)](https://github.com/qodalis-solutions/web-cli/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Usage

```bash
npx @qodalis/create-cli-plugin
```

Without options it asks for the name, description and processor class name. To skip the prompts:

```bash
npx @qodalis/create-cli-plugin --name weather --description "Weather forecasts" --processor-name Weather
```

| Option | Default | Meaning |
| --- | --- | --- |
| `-n, --name <name>` | prompted | Lowercase plugin name; the package becomes `@qodalis/cli-<name>` |
| `-d, --description <text>` | `CLI extension for <name>` | Package description |
| `-p, --processor-name <Name>` | PascalCase of the name | Class name, as in `Cli<Name>CommandProcessor` |

## Standalone and monorepo

| | Standalone (any directory) | Inside the web-cli monorepo |
| --- | --- | --- |
| Output | `./qodalis-cli-<name>/` | `packages/plugins/<name>/` |
| `@qodalis/cli-core` | `^<scaffolder version>` from npm | `workspace:*` |
| Extra files | `.gitignore`, `pnpm-workspace.yaml`, `AGENTS.md` | `project.json` (Nx), `tsconfig.spec.json`; path alias in `tsconfig.base.json` and a Karma test entry in `angular.json` |
| Install | Runs `pnpm install` (or `npm install`) | None (workspace) |
| Build and test | `npm run build` (tsup) into `dist/`; add a test runner of your choice | `pnpm nx build <name>` into `dist/<name>/`, `pnpm nx test <name>` |

In the monorepo, run it through `pnpm run create-plugin -- --name <name> ...`.

## Generated plugin

```
qodalis-cli-weather/
  package.json
  tsup.config.ts          # CJS, ESM, types and the IIFE bundle in umd/
  tsconfig.json
  README.md
  src/
    public-api.ts         # exports weatherModule (ICliModule)
    cli-entrypoint.ts     # IIFE entry that calls bootCliModule() for pkg add
    lib/
      version.ts          # LIBRARY_VERSION, API_VERSION
      index.ts
      processors/
        cli-weather-command-processor.ts
    tests/
      index.spec.ts
```

Implement the command in `src/lib/processors/`, build, then `npm publish --access public` from the package folder. Apps install it with npm and pass `weatherModule` to the terminal (`modules` input/prop, `resolveCliModuleProvider()` in Angular, `engine.registerModule()`), or load it at runtime:

```bash
pkg add @qodalis/cli-weather
```

The standalone project includes an `AGENTS.md` for AI coding agents. With [`@qodalis/mcp-cli`](https://www.npmjs.com/package/@qodalis/mcp-cli), Claude Code can run this scaffolder itself and look up the plugin API.

## Documentation

- [Creating a plugin](https://cli.qodalis.com/docs/create-plugin) and [Core concepts](https://cli.qodalis.com/docs/core-concepts)
- [AI plugin development](https://cli.qodalis.com/docs/ai-plugin-development)

## License

[MIT](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

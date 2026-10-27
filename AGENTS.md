# AGENTS.md

Guide for AI coding agents working in the web-cli monorepo: the Qodalis CLI engine, its Angular/React/Vue/Electron wrappers and 40 plugins. The plugin API reference is at https://cli.qodalis.com/llms-full.txt. Its source is `docs/ai/`.

## Setup and commands

pnpm 12 and Nx 23, on Node 22. pnpm settings live in `pnpm-workspace.yaml`; pnpm 12 ignores `.npmrc`.

```bash
pnpm install --frozen-lockfile
pnpm run build                      # all projects, in dependency order (nx run-many -t build)
pnpm exec nx build <project>        # one project and what it depends on (core, cli, angular-cli, guid, docs, ...)
pnpm exec nx test <project>         # Jasmine on Karma, ChromeHeadless, single run
pnpm exec nx lint <project>         # ESLint 9 (eslint.config.mjs)
pnpm exec nx run-many -t build lint test -p <a> <b>
pnpm run build:affected             # only changed projects
pnpm run create-plugin -- --name <name> --description "<desc>" --processor-name <PascalName>
node tools/check-docs-code-blocks.js   # after editing docs templates
```

- Dev servers (`pnpm run serve:docs`, `serve:angular-demo`, `serve:react-demo`, ...) keep running and use a lot of CPU. Stop them when you are done.
- After tests, check that no Karma or ChromeHeadless processes are left running.

## Layout

| Path | What |
|---|---|
| `packages/core` | `@qodalis/cli-core`: interfaces (`ICliModule`, `ICliCommandProcessor`, `ICliExecutionContext`, ...), models, utils, `API_VERSION` |
| `packages/cli` | `@qodalis/cli`: framework-agnostic engine (`CliEngine`), executor, parsers, built-in commands, `CliTestHarness` |
| `packages/angular-cli`, `react-cli`, `vue-cli`, `electron-cli` | Framework wrappers |
| `packages/create-cli-plugin` | `@qodalis/create-cli-plugin` scaffolder (templates in `src/templates/`) |
| `packages/plugins/<name>` | Plugins published as `@qodalis/cli-<name>` |
| `apps/docs` | Docs site (https://cli.qodalis.com); pages in `src/app/pages/docs/pages/`, nav in `src/app/data/navigation.ts`, text in `src/assets/i18n/en.json` |
| `apps/demo-*` | Demo apps (Angular, React, Vue, vanilla, minimal, Electron) |
| `docs/ai/` | Source of `llms.txt` / `llms-full.txt` (built by `tools/build-llms.js` during the docs build) |

Build order is `core` -> `cli` -> `angular-cli` -> plugins -> wrappers -> apps. Path aliases in `tsconfig.base.json` map `@qodalis/*` to `dist/`, so build a dependency before you test a package that uses it.

## Writing plugins

- Never create a plugin directory by hand. Use `pnpm run create-plugin`. It creates `packages/plugins/<name>`, the tsconfig path alias and the Karma test entry in `angular.json`.
- A plugin exports an `ICliModule` (`<name>Module`) with `apiVersion: API_VERSION`, `name: '@qodalis/cli-<name>'` and `processors`. Commands are registered only through modules. These were removed in 2.0.0-rc.1: `registerProcessor(s)`, `resolveCommandProcessorProvider`, `CliCommandProcessor_TOKEN`, `ICliUmdModule`, `bootUmdModule`, and the `processors` input/prop.
- Processors implement `ICliCommandProcessor` (`packages/core/src/lib/interfaces/command-processor.ts`). Write output through `context.writer`, prompts through `context.reader`, requests through `context.http`, and state through `context.state` with `stateConfiguration`.
- Plugins depend only on `@qodalis/cli-core`, never on a framework.
- Translations go in `ICliModule.translations`, keyed `cli.<command path>.<key>`. Always pass the English default to `translator.t()`.
- API details and examples: https://cli.qodalis.com/llms-full.txt, or the `qcli_docs_search` / `qcli_api` tools of `@qodalis/mcp-cli`.

## Conventions

- TypeScript: 4-space indent, single quotes, semicolons.
- Tests go in `src/tests/*.spec.ts`, using Jasmine and `CliTestHarness` from `@qodalis/cli` for command-level tests. `project.json` test targets use `ChromeHeadless` and `"watch": false`.
- Docs pages: put code blocks in `<pre><code>` flush left, and escape `@` as `&#64;` and braces as `&#123;`/`&#125;`. Add English keys to the end of `en.json`; other languages fall back to English.
- Git: work on `feature/*` branches and open PRs into `develop`. Merges are rebase only, with conventional commits. `main` is released by fast-forwarding to `develop` (`pnpm run release`). A version bump needs a `CHANGELOG.md` section.

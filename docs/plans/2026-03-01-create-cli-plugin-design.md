# Design: @qodalis/create-cli-plugin

A standalone npm CLI tool that scaffolds Qodalis CLI plugins. Installable globally or usable via npx.

## Invocation

- `npx @qodalis/create-cli-plugin`
- `npm create @qodalis/cli-plugin` (npm create convention)
- `create-cli-plugin` (global install)

## Stack

TypeScript, tsup (single CJS bundle), commander.js, @inquirer/prompts.

## Two Modes

### Standalone mode (default)

When NOT inside the web-cli monorepo. Creates a complete independent npm project:

- `package.json` with `@qodalis/cli-core` as real npm dependency
- Self-contained `tsup.config.ts` (no shared config import)
- Standalone `tsconfig.json`
- Full `src/` with processor, module, public-api, cli-entrypoint, version.ts, tests
- `.gitignore`, `README.md`
- Runs `npm install` / `pnpm install` after scaffolding
- Prints next-steps instructions

### Monorepo mode

When CWD is inside web-cli monorepo (detected by `pnpm-workspace.yaml` + `packages/plugins/`):

- Creates plugin at `packages/plugins/<name>/`
- Uses `workspace:*` dependencies
- Imports from `tsup.shared.ts` via relative path
- Updates `tsconfig.json` path aliases
- Runs `pnpm nx build <name>`

## Interactive Prompts

1. Plugin name (validates: lowercase, no spaces, no `cli-` prefix)
2. Description (one-liner)
3. Processor class name (auto-suggested from plugin name, overridable)

## Generated Files (Standalone)

```
qodalis-cli-<name>/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── .gitignore
├── README.md
└── src/
    ├── public-api.ts
    ├── cli-entrypoint.ts
    └── lib/
        ├── version.ts
        ├── index.ts
        ├── processors/
        │   └── cli-<name>-command-processor.ts
        └── tests/
            └── index.spec.ts
```

## Project Location

Lives in the web-cli monorepo at `packages/create-cli-plugin/`:

```
packages/create-cli-plugin/
├── package.json
├── tsup.config.ts
├── tsconfig.json
└── src/
    ├── index.ts           # CLI entry (#!/usr/bin/env node)
    ├── scaffold.ts        # Core scaffolding logic
    ├── prompts.ts         # Interactive prompts
    ├── detect-monorepo.ts # Monorepo detection
    └── templates/         # Template literal functions (bundled)
        ├── package-json.ts
        ├── tsup-config.ts
        ├── tsconfig.ts
        ├── processor.ts
        ├── module.ts
        ├── public-api.ts
        ├── cli-entrypoint.ts
        ├── version.ts
        ├── gitignore.ts
        ├── readme.ts
        └── test.ts
```

Templates are embedded as template literal functions so they bundle into the single output file.

## Publishing

Published via existing `deploy.yml` workflow alongside other packages. The `bin` field in package.json makes it executable.

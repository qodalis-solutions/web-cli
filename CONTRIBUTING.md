# Contributing to Qodalis Web CLI

Thanks for helping out. This page covers the workflow; the full setup, build and
architecture guide is in [DEVELOPER.md](DEVELOPER.md).

## Before you start

- Node.js 22+, pnpm (latest) and Chrome/Chromium (headless tests).
- `pnpm install`, then `pnpm run build` once so the demos can resolve `dist/`.
- Search the [issues](https://github.com/qodalis-solutions/web-cli/issues) first.
  For a new built-in command, open a *command request* issue so the name and
  flags can be agreed before you write it.

## Branches and pull requests

- Branch from `develop` as `feature/<short-name>` (or `fix/<short-name>`).
- Open the PR into **`develop`**. `main` only receives `develop` and publishes to npm.
- PRs are merged with *squash* or *rebase*, never a merge commit.
- Keep a PR to one topic. Add a line to the **Unreleased** section of
  [CHANGELOG.md](CHANGELOG.md) for anything a user of the packages would notice.

## Checks that must pass

```bash
pnpm run lint          # ESLint (flat config in eslint.config.mjs) for every project
pnpm run build         # or pnpm run build:affected
pnpm test              # Jasmine + Karma, ChromeHeadless
pnpm run format        # Prettier
```

CI runs lint, build and test on the projects your change affects.

## Code conventions

- TypeScript, 4-space indent, single quotes, semicolons (see `.editorconfig`).
- Tests live in `src/tests/` of each package as `*.spec.ts`.
- New plugins are scaffolded, never hand-made:
  `pnpm run create-plugin -- --name <name> --description "<desc>" --processor-name <PascalCase>`.
- Public interfaces in `packages/core` carry JSDoc; they end up in the TypeDoc site.
- User-visible strings in the engine go through the translation service
  (`context.services.translation.t(key, fallback)`), with keys added to the
  `lang-*` packages where practical.

## Reporting bugs and security issues

- Bugs: use the *bug report* issue template with steps and the package versions.
- Security problems: do **not** open a public issue; see [SECURITY.md](SECURITY.md).

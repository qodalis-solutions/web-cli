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
- Open the PR into **`develop`**. `main` only moves by fast-forwarding to `develop` (see Releases) and publishes to npm.
- PRs are merged with *squash* or *rebase*, never a merge commit.
- Keep a PR to one topic. Add a line to the next version's section of
  [CHANGELOG.md](CHANGELOG.md) (`## v<version>`, at the top) for anything a user
  of the packages would notice.

## Releases

`main` and `develop` share one linear history: a release fast-forwards `main`
to `develop`, never merges or squashes into it.

1. Bump every package to the new version (all `@qodalis/*` packages share one
   version) and add its `## v<version>` section to `CHANGELOG.md`, in a PR into
   `develop`. CI fails a version bump without that section.
2. Once `develop`'s CI has passed, run `pnpm run release` (admins only;
   `--dry-run` only checks). It verifies that `main` can be fast-forwarded, that
   the changelog section exists and that CI passed on that exact commit, then
   pushes `develop` to `main`.
3. The push publishes the packages to npm, then creates the tag `v<version>` and
   the GitHub release, with that changelog section as its notes. A release that
   keeps the version (a docs fix) leaves the existing release as it is.

`main` rejects force pushes and anything that is not a fast-forward, for
everyone. `node tools/release-notes.js [version]` prints the notes a release
will get.

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

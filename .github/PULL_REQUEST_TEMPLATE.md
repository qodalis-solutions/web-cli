## What

<!-- One or two sentences: what changes and why. Link the issue if there is one. -->

## How to verify

<!-- Commands, demo app, or steps a reviewer can follow. -->

## Checklist

- [ ] Targets `develop` from a `feature/*` or `fix/*` branch
- [ ] `pnpm run lint`, `pnpm run build:affected` and `pnpm test` pass locally
- [ ] Tests added or updated for behaviour changes
- [ ] `CHANGELOG.md` **Unreleased** section updated if users of the packages would notice
- [ ] Docs (`apps/docs`, README of the package) updated if the public API changed

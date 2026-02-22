# Deploy Demo + Docs to GitHub Pages

**Date:** 2026-02-22
**Status:** Approved

## Goal

Deploy the demo application as the primary GitHub Pages site at `cli.qodalis.com/`, with TypeDoc API documentation served at `cli.qodalis.com/docs/`.

## Architecture

A single GitHub Actions workflow (`deploy-docs.yml`) builds and deploys both the demo app and API docs together in one atomic deployment.

### Build Pipeline

1. Build all libraries (core -> cli -> plugins)
2. Build demo app with `ng build demo --base-href /` -> `dist/demo/`
3. Generate TypeDoc -> `docs/`
4. Assemble deployment directory (`deploy/`):
   - `dist/demo/*` -> `deploy/` (demo at root)
   - `docs/*` -> `deploy/docs/` (API docs under /docs/)
   - Write `cli.qodalis.com` -> `deploy/CNAME`
   - Add `deploy/.nojekyll`
5. Deploy `deploy/` to `gh-pages` branch via `peaceiris/actions-gh-pages@v4`

### Site Structure

```
cli.qodalis.com/           -> Demo app (Angular)
cli.qodalis.com/docs/      -> TypeDoc API documentation
```

## Changes

| File | Change |
|------|--------|
| `.github/workflows/deploy-docs.yml` | Replace docs-only deployment with combined demo+docs |
| `assets/github/CNAME` | Update to `cli.qodalis.com` |
| `scripts/typedoc-post-script.js` | Remove CNAME injection (handled in workflow) |

## Constraints

- Proxy-dependent features (server-logs, speed-test) will not work on static GitHub Pages hosting. This is accepted.
- DNS must be updated: point `cli.qodalis.com` to GitHub Pages.

## What Stays the Same

- Workflow triggers: push to `main` + manual dispatch
- npm publish workflow (`deploy.yml`) untouched
- Build/test workflow (`build.yml`) untouched
- Demo app code unchanged

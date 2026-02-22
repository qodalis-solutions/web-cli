# Deploy Demo + Docs to GitHub Pages — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy the demo app at `cli.qodalis.com/` and TypeDoc API docs at `cli.qodalis.com/docs/` via a single combined GitHub Actions workflow.

**Architecture:** One workflow (`deploy-docs.yml`) builds all libraries, the demo app, and TypeDoc docs, then assembles them into a single deployment directory and pushes to the `gh-pages` branch. The demo sits at root, docs at `/docs/`.

**Tech Stack:** GitHub Actions, Angular CLI, TypeDoc, `peaceiris/actions-gh-pages@v4`

---

### Task 1: Update CNAME to new domain

**Files:**
- Modify: `assets/github/CNAME`

**Step 1: Update CNAME content**

Change the contents of `assets/github/CNAME` from:
```
cli-docs.qodalis.com
```
to:
```
cli.qodalis.com
```

**Step 2: Commit**

```bash
git add assets/github/CNAME
git commit -m "chore: update CNAME to cli.qodalis.com"
```

---

### Task 2: Simplify typedoc post-script

The CNAME injection will be handled in the workflow instead. Simplify the post-script to only do any non-CNAME post-processing, or make it a no-op if CNAME was the only thing it did.

**Files:**
- Modify: `scripts/typedoc-post-script.js`

**Step 1: Replace the script contents**

The current script only copies CNAME. Replace with a no-op that logs a message (keeping the script so existing `npm run docs` and references don't break):

```js
// Post-processing for TypeDoc output.
// CNAME injection is handled by the deploy workflow.
console.log('TypeDoc post-processing complete.');
```

**Step 2: Verify npm run docs still works locally**

Run: `npm run docs` (requires libraries to be built first — skip if not built locally)

Expected: TypeDoc generates `docs/` directory, script prints "TypeDoc post-processing complete."

**Step 3: Commit**

```bash
git add scripts/typedoc-post-script.js
git commit -m "chore: remove CNAME injection from typedoc post-script"
```

---

### Task 3: Update deploy-docs workflow to build and deploy demo + docs

**Files:**
- Modify: `.github/workflows/deploy-docs.yml`

**Step 1: Replace the workflow file**

Replace `.github/workflows/deploy-docs.yml` with:

```yaml
name: Deploy Demo & Docs to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Install projects deps
        run: npm run "install projects deps"

      - name: Build all libraries
        run: npm run "build all"

      - name: Build demo application
        run: npx ng build demo --configuration production

      - name: Generate TypeDoc documentation
        run: npx typedoc --out typedoc-output

      - name: Assemble deployment directory
        run: |
          mkdir -p deploy/docs
          cp -r dist/demo/* deploy/
          cp -r typedoc-output/* deploy/docs/
          cp deploy/index.html deploy/404.html
          cp assets/github/CNAME deploy/CNAME
          touch deploy/.nojekyll

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: deploy
```

Key changes from original:
- **Name** updated to reflect combined deployment
- **Added** "Build demo application" step
- **TypeDoc** now outputs to `typedoc-output/` (avoids conflict with any local `docs/` directory)
- **New "Assemble" step** creates `deploy/` directory with:
  - Demo app files at root
  - TypeDoc docs under `docs/`
  - `404.html` (copy of `index.html` for Angular SPA routing on GitHub Pages)
  - `CNAME` from assets
  - `.nojekyll` marker file
- **Publish dir** changed from `docs` to `deploy`

**Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-docs.yml'))"`

Expected: No output (valid YAML)

**Step 3: Commit**

```bash
git add .github/workflows/deploy-docs.yml
git commit -m "feat: deploy demo app + docs to GitHub Pages combined"
```

---

### Task 4: Add deploy/ and typedoc-output/ to .gitignore

These are CI-only build artifacts. Prevent accidental commits.

**Files:**
- Modify: `.gitignore`

**Step 1: Add entries to .gitignore**

Add these lines to the end of `.gitignore`:

```
# Deployment artifacts
/deploy
/typedoc-output
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add deploy and typedoc-output to gitignore"
```

---

### Task 5: Final verification

**Step 1: Review all changes since starting**

Run: `git log --oneline -5`

Expected: 4 new commits (CNAME, post-script, workflow, gitignore)

**Step 2: Verify workflow syntax**

Run: `cat .github/workflows/deploy-docs.yml` — visually confirm YAML structure is correct

**Step 3: Verify CNAME**

Run: `cat assets/github/CNAME`

Expected: `cli.qodalis.com`

---

## Post-deployment DNS Requirement

After the workflow runs, update DNS:
- Add a CNAME record: `cli.qodalis.com` → `qodalis-solutions.github.io`
- (or point to whatever GitHub Pages expects for your organization)

This is a manual step outside of this plan.

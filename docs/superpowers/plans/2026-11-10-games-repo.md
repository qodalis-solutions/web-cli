# Move the game plugins to `qodalis-solutions/cli-games` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `@qodalis/cli-{2048,minesweeper,snake,tetris,wordle,sudoku}` out of web-cli into a new public repo `qodalis-solutions/cli-games` that builds, tests and publishes them under the same npm names, and make web-cli consume them from npm.

**Architecture:** The new repo is a small pnpm workspace (`packages/<game>`) with no Nx: `pnpm -r run build` runs each game's tsup (CJS, ESM, d.ts + IIFE bundle into `packages/<game>/dist`), one root Karma config runs every Jasmine spec on ChromeHeadless through esbuild, one ESLint 9 flat config lints everything. CI mirrors web-cli: build+test on PRs/develop, publish + tag + GitHub release on push to `main`. web-cli deletes the six packages and lists them as npm dependencies for its demos and docs app.

**Tech Stack:** pnpm 12, tsup 9, TypeScript 6, Karma 6 + karma-jasmine + karma-chrome-launcher + karma-esbuild, ESLint 10 flat config + typescript-eslint, Prettier, GitHub Actions, `git filter-repo`.

**Spec:** web-cli issue #207 (first half) and the team-lead brief in this session.

## Global Constraints

- Package names, descriptions, READMEs, keywords, `umd`/`unpkg`, `sideEffects` and `exports` shape stay as today; only paths change (`./dist/...`).
- Version: the new repo starts at `2.4.1` (today's published version) and is bumped to `2.4.2` with a `## v2.4.2` CHANGELOG section before the first push.
- `@qodalis/cli-core` is a **peerDependency** `^2.4.1` plus a **devDependency** `^2.4.1` in every game; never `workspace:*`.
- Linear history everywhere; no merge commits; no attribution lines; push with the n1colae-lupei credential helper.
- web-cli: no version bump; `## Unreleased` CHANGELOG section; branch `feature/games-repo` in worktree `.claude/worktrees/games`; no PR.
- Kill every process started (karma, Chrome, nx, vite); final `ps` sweep.
- npm secret name: `NPM_TOKEN` (web-cli deploy.yml). It cannot be copied; the user adds it to cli-games.

## Review Focus

1. A game's `cli-core` import resolving to a second copy of `@qodalis/cli-core` inside web-cli after the switch to npm (pnpm `autoInstallPeers`) — pinned by Task 10 (`pnpm why @qodalis/cli-core` shows only the workspace package).
2. The IIFE bundle changing its global name or file name (`umd/index.global.js`, `globalName` per game) — pinned by Task 4's build assertion.
3. Published tarball missing `dist` or `README.md` because of a wrong `files` list — pinned by Task 4 (`npm pack --dry-run` lists `dist/public-api.js`, `dist/umd/index.global.js`, `README.md`).
4. `inject-versions` writing the wrong version into `version.ts` (web-cli's script reads `packages/cli`) — pinned by Task 5.
5. `release.sh`/`release-notes.js` reading `packages/cli/package.json`, which does not exist in cli-games — pinned by Task 6 (`node tools/release-notes.js --check` passes for `2.4.2`).

---

### Task 1: Create and configure the GitHub repository

**Files:** none (GitHub API only)

- [ ] `gh repo create qodalis-solutions/cli-games --public --description "..."`.
- [ ] `gh repo edit qodalis-solutions/cli-games --delete-branch-on-merge --enable-rebase-merge --enable-squash-merge=false --enable-merge-commit=false`.
- [ ] After Task 7 pushes `develop` and `main`: set default branch `main` (`gh repo edit --default-branch main`) and create the two rulesets from web-cli's 3186076 ("main changes") and 25660346 ("main history") via `gh api -X POST repos/qodalis-solutions/cli-games/rulesets --input <json>` with `source`, `id`, `node_id`, `_links`, `created_at`, `updated_at`, `current_user_can_bypass` stripped. Required status check context: `Build and Test`.
- [ ] Verify: `gh api repos/qodalis-solutions/cli-games/rulesets` lists both as `active`.

### Task 2: Extract history with git filter-repo

- [ ] Fresh clone: `git clone --no-local https://github.com/qodalis-solutions/web-cli.git <scratch>/web-cli-filter -b develop`.
- [ ] `git filter-repo --path packages/plugins/2048 ... (six) --path-rename packages/plugins/:packages/ --force`.
- [ ] Verify: `git log --oneline | wc -l` > 1 and `ls packages` shows exactly the six games; `git log --diff-filter=A --format=%h -- packages/snake/package.json` is non-empty.
- [ ] Move the result to `/Users/nicolaelupei/Documents/Personal/cli-games-work` (temporary clone used until the submodule is added), rename branch to `develop`, add remote `origin` = cli-games.

### Task 3: Repo scaffold (workspace, lint, format, git hygiene)

**Files:** create `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `tsup.shared.ts`, `eslint.config.mjs`, `.editorconfig`, `.gitignore`, `LICENSE`, `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md` (short), `AGENTS.md`/`CLAUDE.md` (short), `.github/` later.

- [ ] `pnpm-workspace.yaml`: `packages: [packages/*]`, `strictPeerDependencies: false`, `allowBuilds: { esbuild: true }`.
- [ ] Root `package.json` (private, version 2.4.1): scripts `build` (`pnpm -r run build`), `test` (`karma start karma.conf.cjs --single-run`), `lint` (`eslint .`), `format` (`prettier --write "packages/**/*.ts" "tools/**/*.js" "*.{md,json,mjs,cjs,ts}"`), `format:check`, `inject-versions`, `release`. devDependencies: `@qodalis/cli-core ^2.4.1`, `tsup ^9`, `typescript ~6.0`, `eslint ^10`, `@eslint/js ^10`, `typescript-eslint ^8`, `globals ^17`, `eslint-config-prettier ^10`, `prettier ^3`, `karma ~6.4`, `karma-jasmine ~5.1`, `karma-chrome-launcher ~3.2`, `karma-esbuild` (latest), `esbuild` (latest), `jasmine-core ~5.13`, `@types/jasmine ~5.1`, `rxjs ~7.8` (specs use it), `@types/node ^22`.
- [ ] `tsconfig.base.json`: ES2022 target, `strict`, `moduleResolution: bundler`, `lib: [ES2022, DOM]`, `types: []`; **no** `paths` (packages resolve `@qodalis/cli-core` from node_modules).
- [ ] `eslint.config.mjs`: web-cli's TS block + Jasmine block + plain-JS tooling block + prettier; drop Angular/React.
- [ ] Verify: `pnpm install` succeeds; `pnpm run lint` runs (may report nothing yet).
- [ ] Commit: `chore: pnpm workspace, lint and format setup`.

### Task 4: Per-game package build (tsup into `packages/<game>/dist`)

**Files:** modify each `packages/<game>/package.json`, `tsup.config.ts`, `tsconfig.json`; delete `project.json`, `tsconfig.spec.json`.

**Interfaces:** every game exposes `dist/public-api.{js,mjs,d.ts,d.mts}` and `dist/umd/index.global.js`; `package.json` `files: ["dist", "README.md"]`, `main ./dist/public-api.js`, `module ./dist/public-api.mjs`, `types ./dist/public-api.d.ts`, `umd`/`unpkg ./dist/umd/index.global.js`, `exports["."]` with the same three paths, `scripts.build: "tsup"`, `repository.url` → cli-games, `peerDependencies`+`devDependencies` `@qodalis/cli-core ^2.4.1`, no `dependencies`.

- [ ] Write the failing check: a small script `tools/check-dist.js` that asserts for each `packages/*` the five output files exist and `package.json` `main/module/types/umd/exports` paths point to existing files. Run: `node tools/check-dist.js` → FAIL (no dist).
- [ ] Rewrite `tsup.config.ts` per game: `outDir: 'dist'`, `../../tsup.shared`, IIFE `outDir: 'dist/umd'`, same `globalName` as today (`game2048`, `minesweeper`, `snake`, `tetris`, `wordle`, `sudoku`).
- [ ] Rewrite `tsconfig.json` per game: extends `../../tsconfig.base.json`, `include: ["src/**/*"]`, `exclude: ["**/*.spec.ts"]`.
- [ ] Run `pnpm run build` then `node tools/check-dist.js` → PASS; `npm pack --dry-run` in `packages/2048` lists `dist/public-api.js`, `dist/umd/index.global.js`, `README.md`.
- [ ] Commit: `build: each game builds with tsup into its own dist`.

### Task 5: Tests on Karma ChromeHeadless (fallback: vitest)

**Files:** create `karma.conf.cjs`, `tsconfig.spec.json` (root, `types: ["jasmine"]`, includes `packages/*/src/**/*.ts`).

- [ ] `karma.conf.cjs`: frameworks `['jasmine']`, files `packages/*/src/tests/**/*.spec.ts` (watched false), preprocessors `karma-esbuild` with `tsconfig: 'tsconfig.spec.json'`, `format: 'iife'`, `target: 'es2022'`, browsers `ChromeHeadless` (custom launcher `ChromeHeadlessCI` with `--no-sandbox` for CI), `singleRun: true`, reporters `['progress']`.
- [ ] Run `pnpm test`; expect `Executed N of N SUCCESS` with N = total specs of the six games (count `it(` occurrences first: record the number).
- [ ] If karma-esbuild does not work with esbuild ≥0.20 / Karma 6.4 after one honest attempt at fixing config, switch to vitest + jsdom with `globals: true` and a `jasmine` shim? **No**: the specs use `jasmine.createSpy().and.callFake`, `spyOn`, `withContext`, `toBeTrue`; a shim would be a rewrite. Fallback is vitest with the specs ported (`vi.fn`, `vi.spyOn`, `expect(...).toBe(true)`), minimum edits. Record the decision.
- [ ] `pkill -f "karma|ChromeHeadless"` after the run; confirm nothing left.
- [ ] Commit: `test: run the Jasmine specs on Karma ChromeHeadless`.

### Task 6: Tooling (inject-versions, release-notes, release.sh) and version 2.4.2

**Files:** create `tools/inject-versions.js`, `tools/release-notes.js`, `tools/release.sh`; modify `CHANGELOG.md`, every `packages/*/package.json` version, root `package.json` version.

- [ ] `tools/inject-versions.js`: for each `packages/*` with `src/lib/version.ts`, write `LIBRARY_VERSION` from its package.json; set root version from `packages/2048/package.json`.
- [ ] `tools/release-notes.js`: copy; `REPO` → cli-games; `currentVersion()` reads `packages/2048/package.json`; npm link names `@qodalis/cli-2048` "and the other game packages".
- [ ] `tools/release.sh`: copy; version path `packages/2048/package.json`.
- [ ] Bump all six + root to `2.4.2`; `CHANGELOG.md` with `## v2.4.2` saying the games moved here from web-cli, same npm names, now a peer dependency on `@qodalis/cli-core` ≥ 2.4.1.
- [ ] Verify: `node tools/inject-versions.js` writes `2.4.2` into every `version.ts` (grep); `node tools/release-notes.js --check` prints `CHANGELOG.md has release notes for v2.4.2.`; `bash tools/release.sh --dry-run` fails only on "main is already at develop"/missing remote (expected before push) — or run after push.
- [ ] Commit: `chore: release tooling; v2.4.2`.

### Task 7: CI workflows, docs, first push

**Files:** create `.github/workflows/build.yml`, `.github/workflows/deploy.yml`, `README.md` (repo-level), `AGENTS.md`.

- [ ] `build.yml`: PRs into `main`/`develop`, pushes to `develop`, `workflow_dispatch`; steps: checkout (fetch-depth 0), pnpm/action-setup@v6, setup-node@v7 (22, cache pnpm), release-notes check when version changed (reads `packages/2048/package.json`), `pnpm install --frozen-lockfile`, `pnpm run lint`, `pnpm run format:check`, `pnpm run build`, `pnpm test` (`CHROME_BIN` from `browser-actions/setup-chrome@v2`? Ubuntu runners ship Chrome at `/usr/bin/google-chrome`; use the `ChromeHeadlessCI` launcher). Job name **`Build and Test`** (the ruleset's required check).
- [ ] `deploy.yml`: push to `main` + dispatch; `node tools/release-notes.js --check`, install, `node tools/inject-versions.js`, `pnpm run build`, publish loop over `packages/*` with `npm publish --access public` (skip "cannot publish over the previously published versions"), `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`; `release` job creates tag `v<version>` + GitHub release from `tools/release-notes.js`.
- [ ] README: what the repo is, install table (six packages, module exports, commands), dev commands, release flow.
- [ ] Commit: `ci: build and test on PRs and develop, publish on main`.
- [ ] Push `develop`; wait for `Build and Test` to pass (`gh run watch`); then push the same commit to `main` (`git push origin develop:refs/heads/main`); set default branch, create rulesets (Task 1 remainder). Deploy will fail at npm publish without `NPM_TOKEN` — expected; report.

### Task 8: web-cli — remove the packages and configuration

**Files (worktree `.claude/worktrees/games`, branch `feature/games-repo`):** delete `packages/plugins/{2048,minesweeper,snake,tetris,wordle,sudoku}`; modify `tsconfig.base.json`, `angular.json`, `typedoc.json`, `apps/docs/project.json`, `apps/demo-angular/project.json`.

- [ ] Remove the six directories, the six `paths` aliases, the six `angular.json` projects, the six `typedoc.json` entry points, the six `implicitDependencies` entries in both project.json files.
- [ ] Verify: `grep -rn "plugins/\(2048\|minesweeper\|snake\|tetris\|wordle\|sudoku\)" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git . | grep -v docs/plans` → empty.
- [ ] Commit: `refactor: remove the game plugins (moved to qodalis-solutions/cli-games)`.

### Task 9: web-cli — demos and docs take the games from npm

**Files:** modify `apps/demo-react/{package.json,vite.config.ts,tsconfig.app.json}`, `apps/demo-vue/{...same}`, `apps/demo-electron/{package.json,vite.config.ts}`, root `package.json` (docs + demo-angular have no package.json), `pnpm-workspace.yaml` (override `@qodalis/cli-core: workspace:*`), `pnpm-lock.yaml`.

- [ ] Replace `"workspace:*"` with `"^2.4.1"` for the six games in the three demo package.json files; add the six (`^2.4.1`) to root `dependencies`; delete the game entries from the vite `alias` maps and tsconfig `paths`.
- [ ] Add to `pnpm-workspace.yaml` overrides: `'@qodalis/cli-core': 'workspace:*'` so the npm games' peer resolves to the workspace core. `pnpm install` (lockfile updates).
- [ ] Verify: `pnpm why @qodalis/cli-2048` shows 2.4.1 from the registry; `pnpm why @qodalis/cli-core | grep -c "2.4.1"` lists only the workspace link (`link:packages/core`), no registry copy under `node_modules/.pnpm/@qodalis+cli-core@`.
- [ ] Commit: `build: demos and docs take the game plugins from npm`.

### Task 10: web-cli — docs, README, changelog

**Files:** modify `README.md`, `DEVELOPER.md`, `AGENTS.md` (if it lists plugins), `docs/ai/01-overview.md`, `apps/docs/src/app/data/plugins.ts` (comment), `CHANGELOG.md`.

- [ ] README Games line → "live in [cli-games](https://github.com/qodalis-solutions/cli-games)"; Ecosystem table row for cli-games; DEVELOPER.md plugin count 34 and `npx nx test snake` → `npx nx test regex`.
- [ ] `docs/ai/01-overview.md`: one sentence that the game plugins are an external plugin repo (`qodalis-solutions/cli-games`) built the same way; `docs/ai/02-web-plugins.md` where games are the example: keep, add the repo name.
- [ ] `CHANGELOG.md`: `## Unreleased` → "The six game plugins moved to qodalis-solutions/cli-games; same npm names; the demos and docs install them from npm."
- [ ] `node tools/check-docs-code-blocks.js` passes.
- [ ] Commit: `docs: point the game plugins at qodalis-solutions/cli-games`.

### Task 11: web-cli verification and push

- [ ] `pnpm run lint` → no errors. `pnpm run build` → all projects succeed (read the Nx summary line). `pnpm exec nx run-many -t test -p docs,demo-angular,core,cli --browsers=ChromeHeadless --watch=false` or `nx affected -t test --base=origin/develop` → all pass. `pkill -f "karma|ChromeHeadless"`.
- [ ] Demos build: `pnpm exec nx build demo-react demo-vue docs demo-angular` (part of `build`): confirmed by the build step.
- [ ] Push `feature/games-repo` with the credential helper; no PR.
- [ ] Remove the worktree (`git worktree remove .claude/worktrees/games`).

### Task 12: Workspace meta-repo

- [ ] `git submodule add https://github.com/qodalis-solutions/cli-games.git cli-games` (checked out at `main`).
- [ ] CLAUDE.md: table row for `cli-games/`; new `## cli-games` section (commands, tests, release flow, publish on main, `NPM_TOKEN`); plugin list in the web-cli section: 34 plugins, games line removed.
- [ ] Leave staged (`git add .gitmodules cli-games CLAUDE.md`), uncommitted. Keep the pre-existing CLAUDE.md edit intact (stage only after re-reading the diff).
- [ ] Remove the temporary clone `cli-games-work`; final process sweep.

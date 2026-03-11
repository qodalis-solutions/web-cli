# New Features — Master Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 11 new features to web-cli across two phases: core engine enhancements and new plugins.

**Architecture:** Two layers of change:
- **Core engine** (packages/cli, packages/core): ghost-text suggestions, font-size command, output export (capture), command snippets, diff visualizer
- **New plugins** (packages/plugins/*): chart, csv, markdown, stopwatch, cron

All plugins scaffolded via `pnpm run create-plugin`. TDD throughout with Jasmine/Karma using ChromeHeadless.

**Tech Stack:** TypeScript, xterm.js, Jasmine/Karma, tsup, Nx, pnpm workspaces

---

## Phase 1: Core Engine Enhancements

Features that modify `packages/cli` (all independent, any order):

| Feature | Plan File | Effort |
|---|---|---|
| Ghost-text inline suggestions | `2026-03-07-ghost-text-suggestions.md` | High |
| Font size controls | `2026-03-07-font-size-command.md` | Low |
| Output export (capture) | `2026-03-07-output-export-command.md` | Low |
| Command snippets | `2026-03-07-snippets-command.md` | Medium |
| Diff visualizer | `2026-03-07-diff-command.md` | Medium |

**Recommended order:** font-size → output export → snippets → diff → ghost-text (most complex last)

## Phase 2: New Plugins

All fully independent of each other and of Phase 1:

| Feature | Plan File | Effort |
|---|---|---|
| ASCII chart | `2026-03-07-chart-plugin.md` | Medium |
| CSV manipulation | `2026-03-07-csv-plugin.md` | Medium |
| Markdown renderer | `2026-03-07-markdown-plugin.md` | Medium |
| Stopwatch/timer | `2026-03-07-stopwatch-plugin.md` | Medium |
| Cron scheduler | `2026-03-07-cron-plugin.md` | Medium |

## Key Patterns

### Adding a built-in command

1. Create `packages/cli/src/lib/processors/cli-<name>-command-processor.ts`
2. Export from `packages/cli/src/lib/processors/index.ts`
3. Register in `packages/cli/src/lib/services/cli-boot.ts`

### Adding a new plugin

```bash
pnpm run create-plugin -- --name <name> --description "<desc>" --processor-name <PascalCaseName>
```

Then: implement `src/lib/cli-<name>-command-processor.ts`, write tests in `src/tests/`, build with `npx nx build <name>`.

## Build & Test Commands

```bash
cd /home/nicolae/work/cli-workspace/web-cli

# Build specific packages
pnpm run build:core
pnpm run build:cli
npx nx build <plugin-name>

# Test specific package
npx nx test <package-name>

# Always clean up after tests
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

## Where to Register Built-in Processors

Look for the processors array in `packages/cli/src/lib/services/cli-boot.ts` — this is where all built-in command processors are instantiated and registered. Add new ones there.

The state store `storeName` must be globally unique. Suggested names:
- `font-size` for font size
- `snippets` for snippets
- `cron` for cron jobs

# `htop` Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full-screen interactive process/service monitor with live refresh and keyboard actions.

**Architecture:** Single command processor using `enterFullScreenMode` pattern. Merges process registry + background service registry into a unified list. 1s refresh interval, ANSI rendering, keyboard-driven actions.

**Tech Stack:** TypeScript, xterm.js ANSI escape codes, existing CLI framework interfaces.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/cli/src/lib/processors/system/cli-htop-command-processor.ts` | Create | Full-screen htop processor |
| `packages/cli/src/lib/processors/system/index.ts` | Modify | Register htop in systemProcessors |
| `packages/cli/src/tests/htop-command.spec.ts` | Create | Unit tests |

---

### Task 1: Create the htop command processor

**Files:**
- Create: `packages/cli/src/lib/processors/system/cli-htop-command-processor.ts`
- Modify: `packages/cli/src/lib/processors/system/index.ts`

- [ ] **Step 1: Create the processor file**

Implements `ICliCommandProcessor` with:
- `processCommand` — enters full-screen mode, starts refresh interval
- `onData` — handles arrow keys, k/s/t/r/l/q/Esc
- `onResize` — recalculates layout and redraws
- `onDispose` — cleans up references
- `render` — builds ANSI buffer and writes to terminal
- `refreshData` — merges process registry + service registry, deduplicates by PID
- `renderLogsOverlay` — shows service logs in a bordered box
- `writeDescription` — help text

- [ ] **Step 2: Register in system processors**

Add import and instance to `packages/cli/src/lib/processors/system/index.ts`.

- [ ] **Step 3: Build and verify**

Run: `npx nx build cli`

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/lib/processors/system/cli-htop-command-processor.ts packages/cli/src/lib/processors/system/index.ts
git commit -m "feat: add interactive htop command"
```

### Task 2: Add unit tests

**Files:**
- Create: `packages/cli/src/tests/htop-command.spec.ts`

- [ ] **Step 1: Write tests**

Test cases:
- Should enter full-screen mode on processCommand
- Should exit on 'q' key
- Should exit on Escape key
- Should navigate selection with arrow keys
- Should handle empty process list
- Should clamp selection when list shrinks
- Should ignore invalid actions (e.g., 's' on a command-type row)

- [ ] **Step 2: Run tests**

Run: `npx nx test cli`

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/tests/htop-command.spec.ts
git commit -m "test: add htop command unit tests"
```

### Task 3: Manual verification

- [ ] **Step 1: Build all and run React demo**

```bash
npx nx build cli && npx nx build react-cli
# React demo at localhost:4301
```

- [ ] **Step 2: Verify in browser**

- `htop` — opens full-screen monitor
- Arrow keys navigate rows
- `k` kills a process
- `l` shows logs for a service
- `q` exits
- Terminal resize redraws correctly

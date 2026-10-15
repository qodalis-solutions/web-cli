# Panel Status Bar & Animated Header Design

## Goal

Transform the static CLI panel header bar into a live, modern status bar that shows runtime information (process state, background services, server connection, command results) with a subtle ambient glow animation — without adding extra height.

## Required Core Additions

The existing APIs do not expose all the data the status bar needs. These small additions are required:

1. **`lastCommandResult` on `CliExecutionContext`** — After each command execution, store `{ command: string, success: boolean }`. Currently `CliCommandExecutor.executeCommand` tracks `lastExitSuccess` locally but discards it. Expose it as a readable property on the context.

2. **`startedAt` on `CliEngine`** — Record `Date.now()` at the end of `start()`. A simple `readonly` property.

Both are minimal additions. No interface changes to `ICliExecutionContext` in `cli-core` are needed — these are concrete class properties on the implementation side.

## Architecture

### Status Service

A new `CliPanelStatusService` reads runtime data from each tab's `CliEngine` and exposes an observable status model consumed by the header and tab bar templates.

**Data sources and access patterns:**

| Data | Access path | Notes |
|------|-------------|-------|
| Execution state | `context.services.get(CliProcessRegistry_TOKEN).currentPid` | Non-null = running |
| Last command result | `context.lastCommandResult` | New property (see above) |
| Background services | `context.backgroundServices.list()` | Filter to `status === 'running'` |
| Server connection | `context.services.get(CliServerManager_TOKEN).connections` | Iterate; connected if any `.connected === true` |
| Uptime | `engine.startedAt` | New property (see above) |

**Service interface:**

```typescript
interface TabStatus {
    executionState: 'idle' | 'running';
    lastCommandStatus: 'success' | 'error' | null;
    lastCommandName: string | null;
}

interface GlobalStatus {
    runningServiceCount: number;
    totalServiceCount: number;
    serverConnectionState: 'connected' | 'disconnected' | 'none';
    uptime: number;
}

class CliPanelStatusService {
    registerEngine(tabId: number, engine: CliEngine): void;
    unregisterEngine(tabId: number): void;
    getTabStatus$(tabId: number): Observable<TabStatus>;
    getGlobalStatus$(): Observable<GlobalStatus>;
    destroy(): void;
}
```

**Polling strategy:**

- Poll every **2 seconds** using `interval(2000).pipe(map(...), distinctUntilChanged(deepEqual))`
- The process registry, background services, and server manager have no event/observable APIs — polling is required
- Each tab's engine is polled independently
- Global status derives from the active tab's engine
- Subscriptions are managed with `takeUntil(destroy$)` and cleaned up per-tab on `unregisterEngine()`
- Angular change detection: the panel components use default strategy; the service emits via `BehaviorSubject` which Angular detects naturally

### Split Pane Rule

Each tab can have multiple panes, each with its own `CliEngine`. The tab-level status is the **union** of all its panes:

- `executionState`: `'running'` if **any** pane is running, else `'idle'`
- `lastCommandStatus`: from the **most recently completed** command across all panes
- `lastCommandName`: matches `lastCommandStatus`

### Data Flow

```
Tab pane engines (1..N per tab)
        ↓ poll every 2s
CliPanelStatusService
  ├─ tabStatus$ per tab (union of panes)
  └─ globalStatus$ (from active tab)
        ↓ @Input() bindings
CollapsableContentComponent (header indicators + glow)
CliPanelComponent (tab dots)
```

## Component Changes

### CollapsableContentComponent

**Header indicators** — new elements between `.terminal-title` and `.action-buttons`:

```
[⬡ CLI]  [● idle] [⚙ 2/3 services] [✓ help] [⬡ connected] [↑ 14m]  [⇅ ⊟ □ ✕]
  title   ←──────────── status indicators ──────────────→       action buttons
```

- Indicators are `display: flex` with `gap: 14px`, `font-size: 12px`
- Each indicator is a `<span>` with icon/dot + label
- Colors change based on state (see Color System below)
- Passed in via new `@Input()` properties from `CliPanelComponent`

**Glow line** — a `<div>` at the inner edge of `.terminal-header`:

- Gradient: `linear-gradient(90deg, transparent, var(--cli-status-glow, var(--cli-panel-accent)), #a78bfa, var(--cli-status-glow, var(--cli-panel-accent)), transparent)`
- Size: `2px` thick
- `background-size: 200%`
- Idle: `animation: glowShift 8s ease-in-out infinite`, `opacity: 0.4`
- Active (command running): `animation-duration: 3s`, `opacity: 0.8`
- State toggle: CSS class `.glow-active` on the glow element
- Transition: `0.6s ease` on opacity

**Glow line position per panel position:**

| Panel position | Glow line placement | Gradient direction |
|----------------|--------------------|--------------------|
| Bottom | Bottom edge of header (horizontal) | `90deg` (left→right) |
| Top | Top edge of header (horizontal, since header is at bottom via column-reverse) | `90deg` |
| Left | Right edge of header strip (vertical, between header and content) | `180deg` (top→bottom) |
| Right | Left edge of header strip (vertical, between header and content) | `180deg` |

**Responsive overflow:**

| Condition | Indicator display |
|-----------|-------------------|
| Horizontal, width >500px | Full: dot + text labels |
| Horizontal, width 300–500px | Compact: dots and icons only, no text |
| Vertical (left/right) | Hidden — only glow line and tab dots convey state |

Breakpoints use existing `panelWidth` / `currentPosition` properties.

### CliPanelComponent

**Status orchestration:**

- Instantiates `CliPanelStatusService`
- Calls `registerEngine(tabId, engine)` when a tab's `<cli>` emits `(engineReady)`
- Calls `unregisterEngine(tabId)` when a tab is closed
- Subscribes to `getTabStatus$()` for each tab's dot color
- Subscribes to `getGlobalStatus$()` and passes data to `CollapsableContentComponent` via `@Input()`

**Tab dots** — colored dot prepended to each tab label in `.tab-list`:

- `<span>` element, 7px circle, `border-radius: 50%`
- Color reflects per-tab execution state

## Color System

Colors use CSS custom properties with fallback defaults, following the existing theming pattern.

### CSS Custom Properties

```css
--cli-status-idle: #3fb950;
--cli-status-running: #f0883e;
--cli-status-error: #f85149;
--cli-status-neutral: #6b7280;
--cli-status-glow: var(--cli-panel-accent, #818cf8);
```

### Tab Dot States

| State | Color variable | Default | Animation |
|-------|---------------|---------|-----------|
| New (never used) | `--cli-status-neutral` | `#6b7280` | None |
| Idle (last success) | `--cli-status-idle` | `#3fb950` | None |
| Running | `--cli-status-running` | `#f0883e` | `statusPulse 1.5s ease-in-out infinite` |
| Last command failed | `--cli-status-error` | `#f85149` | None; reverts to idle color on next success |

### Header Indicator States

| Indicator | Idle/Good | Active | Error/Bad |
|-----------|-----------|--------|-----------|
| Execution state | Green dot + "idle" | Orange pulsing dot + "running" | — |
| Background services | Grey "⚙ N/M services" | — | — |
| Last command | Green "✓ cmd" | — | Red "✕ cmd" |
| Server connection | Green dot + "connected" | — | Red dot + "disconnected" |
| Uptime | Grey "↑ Xm" | — | — |

Background services show `runningCount/totalCount` (e.g., "⚙ 2/3 services"). Only `status === 'running'` services count toward the running count.

### Glow Line

| State | Opacity | Animation duration |
|-------|---------|-------------------|
| Idle | 0.4 | 8s |
| Command running | 0.8 | 3s |

## Animations

### Glow Shift (header edge line)

```css
@keyframes glowShift {
  0%   { background-position: 200% center; }
  100% { background-position: -200% center; }
}
```

### Pulse (running indicators)

```css
@keyframes statusPulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.3; }
}
```

### Accessibility

```css
@media (prefers-reduced-motion: reduce) {
  .glow-line,
  .status-dot {
    animation: none !important;
  }
}
```

## Files to Create/Modify

| Action | File | Purpose |
|--------|------|---------|
| Create | `packages/angular-cli/src/lib/cli-panel/cli-panel-status.service.ts` | Status aggregation service |
| Modify | `packages/cli/src/lib/engine/cli-engine.ts` | Add `startedAt` property |
| Modify | `packages/cli/src/lib/context/cli-execution-context.ts` | Add `lastCommandResult` property |
| Modify | `packages/cli/src/lib/executor/cli-command-executor.ts` | Store last command result on context |
| Modify | `packages/angular-cli/src/lib/cli-panel/cli-panel.component.ts` | Wire status service, pass to header |
| Modify | `packages/angular-cli/src/lib/cli-panel/cli-panel.component.html` | Add tab dots |
| Modify | `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts` | New status inputs |
| Modify | `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.html` | Add indicators + glow line |
| Modify | `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.sass` | Glow animation, indicator styles, responsive rules |
| Modify | `packages/angular-cli/src/lib/cli-panel/cli-panel.component.sass` | Tab dot styles |

## What Does NOT Change

- **Core interfaces** (`ICliExecutionContext`, `ICliCommandProcessor`) — no interface changes in `cli-core`
- **React/Vue wrappers** — they don't render the panel chrome
- **Header height** — stays at 60px
- **Tab bar height** — stays at 38px
- **Existing button behavior** — position, hide, maximize, collapse, close all unchanged

## Testing

- Verify indicators show correct state after: running a command, command success, command failure
- Verify background services indicator shows running/total count
- Verify server connection indicator reflects actual connection state
- Verify uptime increments correctly
- Verify tab dots update per-tab independently
- Verify split-pane tabs show "running" if any pane is running
- Verify responsive behavior: full → compact → hidden at different widths
- Verify vertical (left/right) position hides indicators, shows only glow line
- Verify glow animation speeds up during command execution, slows when idle
- Verify `prefers-reduced-motion` disables animations
- Verify CSS custom property overrides work for all status colors
- Verify no regressions in existing panel behavior (collapse, resize, close, tabs, panes)

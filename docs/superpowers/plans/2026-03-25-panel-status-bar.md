# Panel Status Bar & Animated Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live status indicators (process state, services, server connection, last command, uptime) and an ambient glow animation to the CLI panel header bar and tab dots.

**Architecture:** A `CliPanelStatusService` polls runtime data from each tab's `CliEngine` every 2s via RxJS and exposes per-tab and global status observables. The collapsable-content header renders indicators between title and buttons. Tab dots show per-tab state. A CSS glow line on the header edge animates based on activity. Two small core additions: `lastCommandResult` on `CliExecutionContext` and `startedAt` on `CliEngine`.

**Tech Stack:** Angular 16, RxJS, TypeScript, SASS, xterm.js ecosystem

**Spec:** `docs/superpowers/specs/2026-03-25-panel-status-bar-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/cli/src/lib/context/cli-execution-context.ts` | Add `lastCommandResult` property |
| Modify | `packages/cli/src/lib/executor/cli-command-executor.ts` | Store command result on context after execution |
| Modify | `packages/cli/src/lib/engine/cli-engine.ts` | Add `startedAt` timestamp |
| Create | `packages/angular-cli/src/lib/cli-panel/cli-panel-status.service.ts` | Status polling + observable aggregation |
| Modify | `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts` | New status @Input() properties |
| Modify | `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.html` | Glow line + indicator elements |
| Modify | `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.sass` | Glow animation, indicator styles, responsive rules |
| Modify | `packages/angular-cli/src/lib/cli-panel/cli-panel.component.ts` | Wire status service, pass data to header |
| Modify | `packages/angular-cli/src/lib/cli-panel/cli-panel.component.html` | Add tab status dots |
| Modify | `packages/angular-cli/src/lib/cli-panel/cli-panel.component.sass` | Tab dot styles |

---

### Task 1: Add `lastCommandResult` to CliExecutionContext

Small core addition — store the last command's name and success/failure on the execution context so the status service can read it.

**Files:**
- Modify: `packages/cli/src/lib/context/cli-execution-context.ts`
- Modify: `packages/cli/src/lib/executor/cli-command-executor.ts`

- [ ] **Step 1: Add the property to CliExecutionContext**

In `packages/cli/src/lib/context/cli-execution-context.ts`, add after the `reader` property (around line 102):

```typescript
/**
 * Result of the most recently executed command.
 * Updated by the command executor after each command completes.
 */
public lastCommandResult?: { command: string; success: boolean };
```

- [ ] **Step 2: Store the result in CliCommandExecutor**

In `packages/cli/src/lib/executor/cli-command-executor.ts`, inside the `executeCommand` method, after the `lastExitSuccess` assignment (around line 177), add:

```typescript
context.lastCommandResult = {
    command: originalCommand,
    success: lastExitSuccess,
};
```

Note: `originalCommand` is the raw command string passed to `executeCommand`. Find the variable name used for the initial command parameter (line 69: `command: string`) — use that. If the executor modifies `command` during alias/pipeline expansion, capture the original at the top of the method.

- [ ] **Step 3: Build and verify**

Run: `npx nx build cli --skip-nx-cache`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/lib/context/cli-execution-context.ts packages/cli/src/lib/executor/cli-command-executor.ts
git commit -m "feat: expose lastCommandResult on CliExecutionContext"
```

---

### Task 2: Add `startedAt` to CliEngine

Record when the engine finished starting so the status service can compute uptime.

**Files:**
- Modify: `packages/cli/src/lib/engine/cli-engine.ts`

- [ ] **Step 1: Add the property**

In `packages/cli/src/lib/engine/cli-engine.ts`, add to the private fields section (around line 72, after `private dragDropService?`):

```typescript
private _startedAt?: number;
```

Add a public getter after the `getRegistry()` method (around line 332):

```typescript
/**
 * Timestamp (ms since epoch) when the engine finished starting.
 */
get startedAt(): number | undefined {
    return this._startedAt;
}
```

- [ ] **Step 2: Set the timestamp at the end of start()**

In the `start()` method, right before the final `this.safeFit()` call (the line with comment `// 10. Final refit`), add:

```typescript
this._startedAt = Date.now();
```

- [ ] **Step 3: Build and verify**

Run: `npx nx build cli --skip-nx-cache`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/lib/engine/cli-engine.ts
git commit -m "feat: add startedAt timestamp to CliEngine"
```

---

### Task 3: Create CliPanelStatusService

The core status service that polls engine data and exposes observables.

**Files:**
- Create: `packages/angular-cli/src/lib/cli-panel/cli-panel-status.service.ts`

- [ ] **Step 1: Create the service file**

Create `packages/angular-cli/src/lib/cli-panel/cli-panel-status.service.ts` with the full implementation:

```typescript
import { BehaviorSubject, Observable, Subject, interval, map, distinctUntilChanged, takeUntil, startWith } from 'rxjs';
import { CliEngine } from '@qodalis/cli';

export interface TabStatus {
    executionState: 'idle' | 'running';
    lastCommandStatus: 'success' | 'error' | null;
    lastCommandName: string | null;
}

export interface GlobalStatus {
    runningServiceCount: number;
    totalServiceCount: number;
    serverConnectionState: 'connected' | 'disconnected' | 'none';
    uptime: number;
}

interface TabEntry {
    engines: Map<number, CliEngine>; // paneId -> engine
    status$: BehaviorSubject<TabStatus>;
    destroy$: Subject<void>;
}

const POLL_INTERVAL_MS = 2000;

const DEFAULT_TAB_STATUS: TabStatus = {
    executionState: 'idle',
    lastCommandStatus: null,
    lastCommandName: null,
};

const DEFAULT_GLOBAL_STATUS: GlobalStatus = {
    runningServiceCount: 0,
    totalServiceCount: 0,
    serverConnectionState: 'none',
    uptime: 0,
};

export class CliPanelStatusService {
    private tabs = new Map<number, TabEntry>();
    private activeTabId: number | undefined;
    private globalStatus$ = new BehaviorSubject<GlobalStatus>(DEFAULT_GLOBAL_STATUS);
    private destroy$ = new Subject<void>();

    /**
     * Register an engine for a specific pane within a tab.
     */
    registerEngine(tabId: number, paneId: number, engine: CliEngine): void {
        let entry = this.tabs.get(tabId);
        if (!entry) {
            entry = {
                engines: new Map(),
                status$: new BehaviorSubject<TabStatus>(DEFAULT_TAB_STATUS),
                destroy$: new Subject<void>(),
            };
            this.tabs.set(tabId, entry);
            this.startPollingTab(tabId, entry);
        }
        entry.engines.set(paneId, engine);
    }

    /**
     * Unregister all engines for a tab (called on tab close).
     */
    unregisterTab(tabId: number): void {
        const entry = this.tabs.get(tabId);
        if (entry) {
            entry.destroy$.next();
            entry.destroy$.complete();
            this.tabs.delete(tabId);
        }
    }

    /**
     * Set the active tab for global status derivation.
     */
    setActiveTab(tabId: number): void {
        this.activeTabId = tabId;
    }

    /**
     * Observable of per-tab status.
     */
    getTabStatus$(tabId: number): Observable<TabStatus> {
        const entry = this.tabs.get(tabId);
        return entry ? entry.status$.asObservable() : new BehaviorSubject(DEFAULT_TAB_STATUS).asObservable();
    }

    /**
     * Observable of global status (from active tab).
     */
    getGlobalStatus$(): Observable<GlobalStatus> {
        return this.globalStatus$.asObservable();
    }

    /**
     * Clean up all subscriptions.
     */
    destroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        for (const entry of this.tabs.values()) {
            entry.destroy$.next();
            entry.destroy$.complete();
        }
        this.tabs.clear();
    }

    private startPollingTab(tabId: number, entry: TabEntry): void {
        interval(POLL_INTERVAL_MS).pipe(
            startWith(0),
            map(() => this.computeTabStatus(entry)),
            distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
            takeUntil(entry.destroy$),
            takeUntil(this.destroy$),
        ).subscribe(status => {
            entry.status$.next(status);
        });

        // Also poll global status from active tab
        interval(POLL_INTERVAL_MS).pipe(
            startWith(0),
            map(() => this.computeGlobalStatus()),
            distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
            takeUntil(this.destroy$),
        ).subscribe(status => {
            this.globalStatus$.next(status);
        });
    }

    private computeTabStatus(entry: TabEntry): TabStatus {
        let running = false;
        let latestResult: { command: string; success: boolean } | undefined;
        let latestTimestamp = 0;

        for (const engine of entry.engines.values()) {
            const context = engine.getContext();
            if (!context) continue;

            // Check process registry for running state
            try {
                const processRegistry = (context as any).services?.get?.('cli-process-registry');
                if (processRegistry?.currentPid != null) {
                    running = true;
                }
            } catch { /* service not available */ }

            // Check last command result
            const result = (context as any).lastCommandResult;
            if (result) {
                // Use the most recent result across panes
                // (we don't have timestamps, so just take the last one encountered)
                latestResult = result;
            }
        }

        return {
            executionState: running ? 'running' : 'idle',
            lastCommandStatus: latestResult ? (latestResult.success ? 'success' : 'error') : null,
            lastCommandName: latestResult?.command ?? null,
        };
    }

    private computeGlobalStatus(): GlobalStatus {
        if (this.activeTabId == null) return DEFAULT_GLOBAL_STATUS;
        const entry = this.tabs.get(this.activeTabId);
        if (!entry) return DEFAULT_GLOBAL_STATUS;

        // Use the first engine in the active tab for global data
        const engine = entry.engines.values().next().value;
        if (!engine) return DEFAULT_GLOBAL_STATUS;

        const context = engine.getContext();
        if (!context) return DEFAULT_GLOBAL_STATUS;

        // Background services
        let runningServiceCount = 0;
        let totalServiceCount = 0;
        try {
            const services = context.backgroundServices?.list() ?? [];
            totalServiceCount = services.length;
            runningServiceCount = services.filter(
                (s: any) => s.status === 'running',
            ).length;
        } catch { /* not available */ }

        // Server connection
        let serverConnectionState: GlobalStatus['serverConnectionState'] = 'none';
        try {
            const serverManager = (context as any).services?.get?.('cli-server-manager');
            if (serverManager?.connections?.size > 0) {
                let anyConnected = false;
                for (const conn of serverManager.connections.values()) {
                    if (conn.connected) {
                        anyConnected = true;
                        break;
                    }
                }
                serverConnectionState = anyConnected ? 'connected' : 'disconnected';
            }
        } catch { /* not available */ }

        // Uptime
        const uptime = engine.startedAt ? Date.now() - engine.startedAt : 0;

        return { runningServiceCount, totalServiceCount, serverConnectionState, uptime };
    }
}
```

- [ ] **Step 2: Build and verify**

Run: `npx nx build angular-cli --skip-nx-cache`
Expected: Build succeeds. The service is not yet wired into any component.

- [ ] **Step 3: Commit**

```bash
git add packages/angular-cli/src/lib/cli-panel/cli-panel-status.service.ts
git commit -m "feat: add CliPanelStatusService for panel status polling"
```

---

### Task 4: Add Glow Line and Status Indicators to Header

Add the ambient glow animation and status indicator elements to the collapsable-content component.

**Files:**
- Modify: `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts`
- Modify: `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.html`
- Modify: `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.sass`

- [ ] **Step 1: Add status @Input() properties to the component**

In `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts`, add new inputs after the existing `@Input()` block (around line 55, after `@Input() isHidden`):

```typescript
// Status bar inputs
@Input() statusExecutionState: 'idle' | 'running' = 'idle';
@Input() statusLastCommand: { name: string; success: boolean } | null = null;
@Input() statusServiceCount: { running: number; total: number } = { running: 0, total: 0 };
@Input() statusServerState: 'connected' | 'disconnected' | 'none' = 'none';
@Input() statusUptime = 0;
```

Add a getter for the formatted uptime:

```typescript
get formattedUptime(): string {
    const mins = Math.floor(this.statusUptime / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h${mins % 60}m`;
}
```

Add a getter to detect if the panel is horizontal (for responsive hiding):

```typescript
get isHorizontal(): boolean {
    return this.currentPosition === 'bottom' || this.currentPosition === 'top';
}
```

Note: Check if `isHorizontal` already exists (it's used in `updateTerminalSize`). If so, make it a public getter or reuse the existing one.

- [ ] **Step 2: Add glow line and indicators to the HTML template**

In `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.html`, inside `.header-content` (around line 66), add the status indicators between `.terminal-title` and `.action-buttons`:

After the `.terminal-title` div (around line 83) and before `.action-buttons` (around line 84), insert:

```html
<!-- Status indicators (horizontal positions only) -->
<div class="status-indicators" *ngIf="isHorizontal">
    <!-- Execution state -->
    <span class="status-item" [class.status-running]="statusExecutionState === 'running'">
        <span class="status-dot" [class.dot-idle]="statusExecutionState === 'idle'" [class.dot-running]="statusExecutionState === 'running'"></span>
        <span class="status-label">{{ statusExecutionState }}</span>
    </span>

    <!-- Background services (only if any exist) -->
    <span class="status-item" *ngIf="statusServiceCount.total > 0">
        <span class="status-icon">&#9881;</span>
        <span class="status-label">{{ statusServiceCount.running }}/{{ statusServiceCount.total }}</span>
    </span>

    <!-- Last command -->
    <span class="status-item" *ngIf="statusLastCommand">
        <span class="status-icon" [class.status-success]="statusLastCommand.success" [class.status-error]="!statusLastCommand.success">
            {{ statusLastCommand.success ? '&#10003;' : '&#10005;' }}
        </span>
        <span class="status-label">{{ statusLastCommand.name }}</span>
    </span>

    <!-- Server connection -->
    <span class="status-item" *ngIf="statusServerState !== 'none'">
        <span class="status-dot" [class.dot-idle]="statusServerState === 'connected'" [class.dot-error]="statusServerState === 'disconnected'"></span>
        <span class="status-label">{{ statusServerState === 'connected' ? 'connected' : 'disconnected' }}</span>
    </span>

    <!-- Uptime -->
    <span class="status-item status-muted" *ngIf="statusUptime > 0">
        <span class="status-icon">&uarr;</span>
        <span class="status-label">{{ formattedUptime }}</span>
    </span>
</div>
```

Add the glow line inside `.terminal-header`, at the very end (just before the closing div of `.terminal-header`). This goes after `.header-content`:

```html
<!-- Ambient glow line -->
<div class="glow-line" [class.glow-active]="statusExecutionState === 'running'"></div>
```

- [ ] **Step 3: Add SASS styles**

In `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.sass`, add at the end of the file (before the position dropdown section or at the very end):

```sass
// ─── Status indicators ──────────────────────────────────

.status-indicators
  display: flex
  align-items: center
  gap: 14px
  margin-left: 24px
  font-size: 12px
  overflow: hidden
  white-space: nowrap

.status-item
  display: flex
  align-items: center
  gap: 5px
  color: var(--cli-panel-text-secondary, rgba(255, 255, 255, 0.6))

.status-dot
  width: 6px
  height: 6px
  border-radius: 50%
  flex-shrink: 0
  background: var(--cli-status-neutral, #6b7280)

  &.dot-idle
    background: var(--cli-status-idle, #3fb950)

  &.dot-running
    background: var(--cli-status-running, #f0883e)
    animation: statusPulse 1.5s ease-in-out infinite

  &.dot-error
    background: var(--cli-status-error, #f85149)

.status-icon
  flex-shrink: 0

  &.status-success
    color: var(--cli-status-idle, #3fb950)

  &.status-error
    color: var(--cli-status-error, #f85149)

.status-label
  overflow: hidden
  text-overflow: ellipsis

.status-muted
  color: var(--cli-panel-text-secondary, rgba(255, 255, 255, 0.4))

.status-running
  color: var(--cli-status-running, #f0883e)

// ─── Compact mode: hide labels when narrow ──────────────

.terminal-wrapper
  &[data-position="bottom"],
  &[data-position="top"]
    @media (max-width: 500px)
      .status-label
        display: none

// ─── Glow line ──────────────────────────────────────────

.glow-line
  position: absolute
  bottom: 0
  left: 0
  right: 0
  height: 2px
  background: linear-gradient(90deg, transparent, var(--cli-status-glow, var(--cli-panel-accent, #818cf8)), #a78bfa, var(--cli-status-glow, var(--cli-panel-accent, #818cf8)), transparent)
  background-size: 200% 100%
  opacity: 0.4
  animation: glowShift 8s ease-in-out infinite
  transition: opacity 0.6s ease
  pointer-events: none

  &.glow-active
    opacity: 0.8
    animation-duration: 3s

// Glow line for vertical positions (left/right)
.terminal-wrapper[data-position="left"]
  .glow-line
    bottom: auto
    top: 0
    left: auto
    right: 0
    width: 2px
    height: 100%
    background: linear-gradient(180deg, transparent, var(--cli-status-glow, var(--cli-panel-accent, #818cf8)), #a78bfa, var(--cli-status-glow, var(--cli-panel-accent, #818cf8)), transparent)
    background-size: 100% 200%

.terminal-wrapper[data-position="right"]
  .glow-line
    bottom: auto
    top: 0
    left: 0
    right: auto
    width: 2px
    height: 100%
    background: linear-gradient(180deg, transparent, var(--cli-status-glow, var(--cli-panel-accent, #818cf8)), #a78bfa, var(--cli-status-glow, var(--cli-panel-accent, #818cf8)), transparent)
    background-size: 100% 200%

// ─── Animations ─────────────────────────────────────────

@keyframes glowShift
  0%
    background-position: 200% center
  100%
    background-position: -200% center

@keyframes statusPulse
  0%, 100%
    opacity: 1
  50%
    opacity: 0.3

// ─── Accessibility ──────────────────────────────────────

@media (prefers-reduced-motion: reduce)
  .glow-line,
  .status-dot
    animation: none !important
```

- [ ] **Step 4: Build and verify**

Run: `npx nx build angular-cli --skip-nx-cache`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/angular-cli/src/lib/collapsable-content/
git commit -m "feat: add glow line and status indicators to panel header"
```

---

### Task 5: Add Tab Status Dots

Add colored activity dots to each tab in the tab bar.

**Files:**
- Modify: `packages/angular-cli/src/lib/cli-panel/cli-panel.component.html`
- Modify: `packages/angular-cli/src/lib/cli-panel/cli-panel.component.sass`
- Modify: `packages/angular-cli/src/lib/cli-panel/cli-panel.component.ts`

- [ ] **Step 1: Add tab status tracking to the component**

In `packages/angular-cli/src/lib/cli-panel/cli-panel.component.ts`, add a property to track per-tab status:

```typescript
tabStatuses: Record<number, TabStatus> = {};
```

Import the `TabStatus` type:

```typescript
import { CliPanelStatusService, TabStatus } from './cli-panel-status.service';
```

Add a helper method to get the dot CSS class for a tab:

```typescript
getTabDotClass(tabId: number): string {
    const status = this.tabStatuses[tabId];
    if (!status) return 'dot-neutral';
    if (status.executionState === 'running') return 'dot-running';
    if (status.lastCommandStatus === 'error') return 'dot-error';
    if (status.lastCommandStatus === 'success') return 'dot-idle';
    return 'dot-neutral';
}
```

- [ ] **Step 2: Add dot element to tab HTML**

In `packages/angular-cli/src/lib/cli-panel/cli-panel.component.html`, inside each tab `<li>` element, add a dot span before the tab title. Find the tab title element (around line 39: `<span class="tab-title">`). Insert before it:

```html
<span class="tab-dot" [ngClass]="getTabDotClass(tab.id)"></span>
```

- [ ] **Step 3: Add tab dot styles**

In `packages/angular-cli/src/lib/cli-panel/cli-panel.component.sass`, add:

```sass
// ─── Tab status dots ─────────────────────────────────────

.tab-dot
  width: 7px
  height: 7px
  border-radius: 50%
  flex-shrink: 0
  background: var(--cli-status-neutral, #6b7280)

  &.dot-idle
    background: var(--cli-status-idle, #3fb950)

  &.dot-running
    background: var(--cli-status-running, #f0883e)
    animation: statusPulse 1.5s ease-in-out infinite

  &.dot-error
    background: var(--cli-status-error, #f85149)

  &.dot-neutral
    background: var(--cli-status-neutral, #6b7280)

@keyframes statusPulse
  0%, 100%
    opacity: 1
  50%
    opacity: 0.3

@media (prefers-reduced-motion: reduce)
  .tab-dot
    animation: none !important
```

Also ensure the tab `<li>` has `display: flex; align-items: center; gap: 7px` so the dot sits inline. Check the existing tab styles — if the tab content is already flex, just add the gap. If not, add it to the appropriate selector.

- [ ] **Step 4: Build and verify**

Run: `npx nx build angular-cli --skip-nx-cache`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/angular-cli/src/lib/cli-panel/
git commit -m "feat: add status dots to panel tab bar"
```

---

### Task 6: Wire Everything Together in CliPanelComponent

Connect the status service to the panel component, subscribe to status observables, and pass data to the header and tab dots.

**Files:**
- Modify: `packages/angular-cli/src/lib/cli-panel/cli-panel.component.ts`
- Modify: `packages/angular-cli/src/lib/cli-panel/cli-panel.component.html`

- [ ] **Step 1: Instantiate and wire the status service**

In `packages/angular-cli/src/lib/cli-panel/cli-panel.component.ts`:

Add imports:

```typescript
import { CliPanelStatusService, TabStatus, GlobalStatus } from './cli-panel-status.service';
import { Subject, takeUntil } from 'rxjs';
```

Add properties:

```typescript
private statusService = new CliPanelStatusService();
private destroy$ = new Subject<void>();
globalStatus: GlobalStatus = {
    runningServiceCount: 0,
    totalServiceCount: 0,
    serverConnectionState: 'none',
    uptime: 0,
};
```

Subscribe to global status in `ngOnInit` (or `ngAfterViewInit` if `ngOnInit` isn't used):

```typescript
this.statusService.getGlobalStatus$().pipe(
    takeUntil(this.destroy$),
).subscribe(status => {
    this.globalStatus = status;
});
```

- [ ] **Step 2: Register engines when tabs are created**

Find where `<cli>` components emit `(engineReady)` in the template. In the template (`cli-panel.component.html`), the `<cli>` component is inside each pane. Find the `(engineReady)` binding and update it to also register the engine with the status service.

In the component, add or modify the engine-ready handler. Look for an existing handler. If none exists, create one:

```typescript
onPaneEngineReady(tabId: number, paneId: number, engine: CliEngine): void {
    this.statusService.registerEngine(tabId, paneId, engine);
}
```

And ensure the `(engineReady)` binding in the template passes tab and pane IDs:

```html
(engineReady)="onPaneEngineReady(tab.id, pane.id, $event)"
```

- [ ] **Step 3: Handle tab selection and cleanup**

In `selectTab()` method, add:

```typescript
this.statusService.setActiveTab(tab.id);
```

In `closeTab()` method, add:

```typescript
this.statusService.unregisterTab(tabId);
```

In `ngOnDestroy()`, add:

```typescript
this.statusService.destroy();
this.destroy$.next();
this.destroy$.complete();
```

- [ ] **Step 4: Subscribe to per-tab status for dot colors**

After registering an engine, subscribe to its tab status:

```typescript
this.statusService.getTabStatus$(tabId).pipe(
    takeUntil(this.destroy$),
).subscribe(status => {
    this.tabStatuses[tabId] = status;
});
```

- [ ] **Step 5: Pass status data to collapsable-content in the template**

In `cli-panel.component.html`, find the `<collapsable-content>` element and add the new input bindings:

```html
[statusExecutionState]="tabStatuses[resolvedActiveTabId]?.executionState || 'idle'"
[statusLastCommand]="tabStatuses[resolvedActiveTabId]?.lastCommandStatus ? { name: tabStatuses[resolvedActiveTabId]?.lastCommandName || '', success: tabStatuses[resolvedActiveTabId]?.lastCommandStatus === 'success' } : null"
[statusServiceCount]="{ running: globalStatus.runningServiceCount, total: globalStatus.totalServiceCount }"
[statusServerState]="globalStatus.serverConnectionState"
[statusUptime]="globalStatus.uptime"
```

- [ ] **Step 6: Set initial active tab**

In `addTab()`, after a tab is added and becomes active, call:

```typescript
this.statusService.setActiveTab(tab.id);
```

- [ ] **Step 7: Build and verify**

Run: `npx nx build angular-cli --skip-nx-cache`
Expected: Build succeeds.

- [ ] **Step 8: Manually test**

Run: `npx nx serve docs --port 4300`

Open http://localhost:4300 and verify:
1. Panel header shows the glow line animating slowly
2. Opening the panel shows "idle" status with green dot
3. Typing a command (e.g., `help`) shows result indicator (✓ help)
4. Tab dots show green after command success
5. The glow line speeds up briefly while a longer command runs (try `speed-test` if available)
6. Moving panel to left/right position hides text indicators but keeps glow line
7. Multiple tabs each have their own dot color

Kill the dev server when done.

- [ ] **Step 9: Commit**

```bash
git add packages/angular-cli/src/lib/cli-panel/ packages/angular-cli/src/lib/collapsable-content/
git commit -m "feat: wire panel status service to header and tab dots"
```

---

### Task 7: Build All and Final Verification

Full build and cleanup.

**Files:** None (verification only)

- [ ] **Step 1: Full build**

Run: `npx nx run-many -t build --skip-nx-cache`
Expected: All 31 projects build successfully.

- [ ] **Step 2: Run tests**

Run: `npx nx run-many -t test`
Expected: All tests pass. Kill any lingering Karma/Chrome processes after: `pkill -f "karma|ChromeHeadless" 2>/dev/null`

- [ ] **Step 3: Final commit if any changes needed**

If any fixes were needed during verification, commit them:

```bash
git add -A
git commit -m "fix: address build/test issues in panel status bar"
```

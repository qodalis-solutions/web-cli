# CLI Panel Programmatic Control API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose a unified imperative + reactive API for `CliPanel` across Angular, React, and Vue, enabling programmatic control of panel chrome, tabs, panes, and engine access.

**Architecture:** A shared `ICliPanelRef` interface in `@qodalis/cli-core` defines the contract. Each framework panel implements it using idiomatic patterns (Angular `@ViewChild`, React `forwardRef`+`useImperativeHandle`, Vue `expose()`). Six properties support hybrid controlled/uncontrolled bindings with change events.

**Tech Stack:** TypeScript, Angular 16, React 18, Vue 3, xterm.js

**Spec:** `docs/plans/2026-03-25-cli-panel-programmatic-api-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `packages/core/src/lib/interfaces/cli-panel-ref.ts` | `ICliPanelRef`, `CliPanelState`, `CliPanelTabState`, `CliPanelPaneState` interfaces |

### Modified Files

| File | Changes |
|---|---|
| `packages/core/src/lib/interfaces/index.ts` | Export new interface file |
| `packages/angular-cli/src/lib/cli-panel/cli-panel.component.ts` | Implement `ICliPanelRef`, add `@Input`/`@Output` pairs for 6 bindable properties, hybrid logic, public API methods |
| `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts` | Make `toggleTerminal()`, `toggleMaximizationTerminal()`, `hideTerminal()`, `unhideTerminal()`, resize methods callable from parent |
| `packages/react-cli/src/CliPanel.tsx` | Add `forwardRef`, `useImperativeHandle`, controlled props, callback props, structural events |
| `packages/vue-cli/src/CliPanel.ts` | Add `expose()` with `ICliPanelRef`, `v-model`-compatible emits, structural events |

---

## Task 1: Core Interface Definition

**Files:**
- Create: `packages/core/src/lib/interfaces/cli-panel-ref.ts`
- Modify: `packages/core/src/lib/interfaces/index.ts`

- [ ] **Step 1: Create the `ICliPanelRef` interface file**

```typescript
// packages/core/src/lib/interfaces/cli-panel-ref.ts
import { CliPanelPosition } from '../models/options';

/**
 * Framework-agnostic interface for programmatic control of the CLI panel.
 *
 * CliEngine is referenced as a generic to avoid a circular dependency
 * between @qodalis/cli-core and @qodalis/cli. Framework implementations
 * resolve this to the concrete CliEngine class.
 */
export interface ICliPanelRef<TEngine = unknown> {
    // ── Panel chrome ──

    /** Expand the panel (sets collapsed=false). Initializes the first tab on first call. */
    open(): void;
    /** Collapse the panel body (sets collapsed=true). */
    collapse(): void;
    toggleCollapse(): void;
    /** Hide the panel to a small viewport-edge tab (reversible via unhide). */
    hide(): void;
    unhide(): void;
    toggleHide(): void;
    /** Destroy the panel (removes from DOM). Irreversible. */
    close(): void;
    maximize(): void;
    restore(): void;
    toggleMaximize(): void;
    /**
     * Set panel dimensions. Only the dimension relevant to the current
     * position is applied immediately (height for top/bottom, width for
     * left/right). The other dimension is stored for when the position changes.
     */
    resize(dimensions: { height?: number; width?: number }): void;
    setPosition(position: CliPanelPosition): void;

    // ── Tabs ──

    /** Create a new tab. Returns the new tab's ID. Title defaults to "Terminal {id}". */
    addTab(title?: string): number;
    /** Close a tab by ID. No-op if the ID does not exist. */
    closeTab(tabId: number): void;
    /** Activate a tab by ID. No-op if the ID does not exist. */
    selectTab(tabId: number): void;
    /** Programmatically rename a tab. No-op if the ID does not exist. */
    renameTab(tabId: number, title: string): void;

    // ── Panes ──

    /**
     * Split the active pane (or a pane within the specified tab) to create
     * a new pane to the right. Returns the new pane's ID.
     */
    splitPane(tabId?: number): number;
    /**
     * Close a pane by ID. Searches all tabs for the pane.
     * No-op if the ID does not exist.
     */
    closePane(paneId: number): void;

    // ── Engine access ──

    /** Get the engine for a specific pane, or the active pane if omitted. */
    getEngine(paneId?: number): TEngine | undefined;

    // ── State ──

    getState(): CliPanelState;
}

export interface CliPanelState {
    collapsed: boolean;
    hidden: boolean;
    maximized: boolean;
    position: CliPanelPosition;
    height: number;
    width: number;
    activeTabId: number;
    activePaneId: number;
    tabs: CliPanelTabState[];
}

export interface CliPanelTabState {
    id: number;
    title: string;
    panes: CliPanelPaneState[];
}

export interface CliPanelPaneState {
    id: number;
    widthPercent: number;
}
```

Note: `ICliPanelRef` uses a generic `TEngine = unknown` to avoid a circular dependency between `@qodalis/cli-core` and `@qodalis/cli`. Each framework panel types this as `CliEngine` from `@qodalis/cli`.

- [ ] **Step 2: Export from interfaces barrel**

In `packages/core/src/lib/interfaces/index.ts`, add at the end:

```typescript
export * from './cli-panel-ref';
```

- [ ] **Step 3: Build core and verify**

```bash
npx nx build core
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/lib/interfaces/cli-panel-ref.ts packages/core/src/lib/interfaces/index.ts
git commit -m "feat(core): add ICliPanelRef interface for programmatic panel control"
```

---

## Task 2: Angular Panel — Implement `ICliPanelRef`

**Files:**
- Modify: `packages/angular-cli/src/lib/cli-panel/cli-panel.component.ts` (lines 55-520+)
- Modify: `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts` (lines 30-213)

### Step-by-step

- [ ] **Step 1: Add new `@Input`/`@Output` pairs to `CliPanelComponent`**

After the existing `@Output() onClose` (line 77), add the bindable property inputs and change outputs, plus the structural event outputs.

```typescript
// ── Bindable properties (hybrid controlled/uncontrolled) ──

@Input() collapsed?: boolean;
@Output() collapsedChange = new EventEmitter<boolean>();

@Input() hidden?: boolean;
@Output() hiddenChange = new EventEmitter<boolean>();

@Input() maximized?: boolean;
@Output() maximizedChange = new EventEmitter<boolean>();

@Input() activeTabId?: number;
@Output() activeTabIdChange = new EventEmitter<number>();

@Input() position?: CliPanelPosition;
@Output() positionChange = new EventEmitter<CliPanelPosition>();

@Input() height?: number;
@Output() heightChange = new EventEmitter<number>();

@Input() width?: number;
@Output() widthChange = new EventEmitter<number>();

// ── Structural events ──

@Output() onTabAdded = new EventEmitter<{ tabId: number }>();
@Output() onTabClosed = new EventEmitter<{ tabId: number }>();
@Output() onPaneSplit = new EventEmitter<{ paneId: number; tabId: number }>();
@Output() onPaneClosed = new EventEmitter<{ paneId: number }>();
```

- [ ] **Step 2: Add internal state tracking for hybrid mode**

Add private fields to track whether each bindable property is controlled:

```typescript
private _internalCollapsed = true;
private _internalHidden = false;
private _internalMaximized = false;
private _internalActiveTabId = 0;
private _internalHeight = 600;
private _internalWidth = 400;
```

Add helper methods for hybrid resolution:

```typescript
protected get resolvedCollapsed(): boolean {
    return this.collapsed !== undefined ? this.collapsed : this._internalCollapsed;
}

private setCollapsed(value: boolean): void {
    this._internalCollapsed = value;
    this.collapsedChange.emit(value);
}

protected get resolvedHidden(): boolean {
    return this.hidden !== undefined ? this.hidden : this._internalHidden;
}

private setHidden(value: boolean): void {
    this._internalHidden = value;
    this.hiddenChange.emit(value);
}

protected get resolvedMaximized(): boolean {
    return this.maximized !== undefined ? this.maximized : this._internalMaximized;
}

private setMaximized(value: boolean): void {
    this._internalMaximized = value;
    this.maximizedChange.emit(value);
}

protected get resolvedActiveTabId(): number {
    return this.activeTab !== undefined ? this.activeTab : this._internalActiveTabId;
}

private setActiveTabId(value: number): void {
    this._internalActiveTabId = value;
    this.activeTabIdChange.emit(value);
}

protected get resolvedHeight(): number {
    return this.height !== undefined ? this.height : this._internalHeight;
}

private setHeight(value: number): void {
    this._internalHeight = value;
    this.heightChange.emit(value);
}

protected get resolvedWidth(): number {
    return this.width !== undefined ? this.width : this._internalWidth;
}

private setWidth(value: number): void {
    this._internalWidth = value;
    this.widthChange.emit(value);
}

protected get resolvedPosition(): CliPanelPosition {
    return this.position !== undefined ? this.position : this.currentPosition;
}
```

- [ ] **Step 3: Wire `CollapsableContentComponent` for delegation**

The `CollapsableContentComponent` currently owns collapse, maximize, hide, and resize state. For programmatic control, the `CliPanelComponent` needs to drive these. Update the `CollapsableContentComponent` to accept the resolved state via `@Input` bindings (it already has `isCollapsed`, `isMaximized`, `isHidden` as `@Input`s) and expose methods for the parent to call.

In `collapsable-content.component.ts`, refactor the toggle-based methods to support direct state setting. The existing `toggleTerminal()` mutates `this.isCollapsed` internally, but since `isCollapsed` is an `@Input`, the parent's binding will override it on the next change detection cycle. To avoid state inconsistency, add direct setter methods that the parent calls instead of toggle methods:

```typescript
/** Set collapsed state directly (called by parent CliPanelComponent). */
setCollapsed(value: boolean): void {
    this.isCollapsed = value;
    this.onToggle.emit(value);
}

/** Set maximized state directly (called by parent CliPanelComponent). */
setMaximized(value: boolean): void {
    if (value && !this.isMaximized) {
        this.previousPanelHeight = this.panelHeight;
        this.previousPanelWidth = this.panelWidth;
    } else if (!value && this.isMaximized) {
        this.panelHeight = this.previousPanelHeight;
        this.panelWidth = this.previousPanelWidth;
    }
    this.isMaximized = value;
    this.updateTerminalSize();
}

/** Programmatically set panel dimensions. */
setDimensions(dims: { height?: number; width?: number }): void {
    if (dims.height !== undefined) {
        this.panelHeight = dims.height;
        this.previousPanelHeight = dims.height;
    }
    if (dims.width !== undefined) {
        this.panelWidth = dims.width;
        this.previousPanelWidth = dims.width;
    }
    this.updateTerminalSize();
}
```

Keep existing `toggleTerminal()`, `toggleMaximizationTerminal()`, `hideTerminal()`, `unhideTerminal()` for user-interaction paths (header buttons still call these). The `CliPanelComponent` programmatic API uses the new direct setters instead.

- [ ] **Step 4: Implement `ICliPanelRef` methods on `CliPanelComponent`**

Update the class declaration to implement `ICliPanelRef`:

```typescript
import { ICliPanelRef, CliPanelState } from '@qodalis/cli-core';
import { CliEngine } from '@qodalis/cli';

export class CliPanelComponent implements OnInit, OnDestroy, ICliPanelRef<CliEngine> {
```

Add the public API methods:

```typescript
// ── ICliPanelRef implementation ──

open(): void {
    if (this.resolvedCollapsed) {
        this._internalCollapsed = false;
        this.collapsedChange.emit(false);
        this.collapsableContent?.setCollapsed(false);
        if (!this.initialized) {
            this.initialized = true;
            this.addTab();
            this.setupThemeSync();
        }
    }
}

collapse(): void {
    if (!this.resolvedCollapsed) {
        this._internalCollapsed = true;
        this.collapsedChange.emit(true);
        this.collapsableContent?.setCollapsed(true);
    }
}

toggleCollapse(): void {
    if (this.resolvedCollapsed) {
        this.open();
    } else {
        this.collapse();
    }
}

hide(): void {
    if (!this.resolvedHidden) {
        this._internalHidden = true;
        this.hiddenChange.emit(true);
        this.collapsableContent?.hideTerminal();
    }
}

unhide(): void {
    if (this.resolvedHidden) {
        this._internalHidden = false;
        this.hiddenChange.emit(false);
        this.collapsableContent?.unhideTerminal();
    }
}

toggleHide(): void {
    if (this.resolvedHidden) {
        this.unhide();
    } else {
        this.hide();
    }
}

close(): void {
    this.visible = false;
    this.onClose.emit();
}

maximize(): void {
    if (!this.resolvedMaximized) {
        this._internalMaximized = true;
        this.maximizedChange.emit(true);
        this.collapsableContent?.setMaximized(true);
    }
}

restore(): void {
    if (this.resolvedMaximized) {
        this._internalMaximized = false;
        this.maximizedChange.emit(false);
        this.collapsableContent?.setMaximized(false);
    }
}

toggleMaximize(): void {
    if (this.resolvedMaximized) {
        this.restore();
    } else {
        this.maximize();
    }
}

resize(dimensions: { height?: number; width?: number }): void {
    if (dimensions.height !== undefined) {
        this.setHeight(dimensions.height);
    }
    if (dimensions.width !== undefined) {
        this.setWidth(dimensions.width);
    }
    this.collapsableContent?.setDimensions(dimensions);
}

setPosition(pos: CliPanelPosition): void {
    this.currentPosition = pos;
    savePanelPosition(pos);
    this.positionChange.emit(pos);
}
```

- [ ] **Step 5: Update existing `addTab()` to return ID and accept title**

Change the existing `addTab()` method (line 161) from:

```typescript
addTab(): void {
    const tabId = this.nextTabId++;
    const paneId = this.nextPaneId++;
    this.tabs.push({
        id: tabId,
        title: `Terminal ${tabId}`,
        isEditing: false,
        panes: [{ id: paneId, widthPercent: 100 }],
    });
    this.activeTabId = tabId;
    this.activePaneId = paneId;
}
```

To:

```typescript
addTab(title?: string): number {
    const tabId = this.nextTabId++;
    const paneId = this.nextPaneId++;
    this.tabs.push({
        id: tabId,
        title: title ?? `Terminal ${tabId}`,
        isEditing: false,
        panes: [{ id: paneId, widthPercent: 100 }],
    });
    this._internalActiveTabId = tabId;
    this.activePaneId = paneId;
    this.activeTabIdChange.emit(tabId);
    this.onTabAdded.emit({ tabId });
    return tabId;
}
```

- [ ] **Step 6: Add `renameTab()` method**

```typescript
renameTab(tabId: number, title: string): void {
    const tab = this.findTab(tabId);
    if (tab) {
        tab.title = title;
    }
}
```

- [ ] **Step 7: Update `splitRight()` → add `splitPane()` wrapper returning pane ID**

Keep the existing `splitRight()` for internal use but refactor it to return the new pane ID. Then alias `splitPane` to it:

```typescript
splitPane(tabId?: number): number {
    const targetTabId = tabId ?? this.activeTabId;
    const tab = this.findTab(targetTabId);
    if (!tab) return -1;

    const paneId = this.nextPaneId++;
    const newPane: TerminalPane = { id: paneId, widthPercent: 0 };
    tab.panes.push(newPane);
    this.normalizePaneWidths(tab.panes);
    this.activePaneId = paneId;
    this.onPaneSplit.emit({ paneId, tabId: targetTabId });
    return paneId;
}
```

Update existing `splitRight()` calls (in `contextMenuSplitRight()`) to call `splitPane()` instead.

- [ ] **Step 8: Update `closePane()` to accept single paneId and search all tabs**

Replace the existing `closePane(tabId, paneId)` (line 357) with:

```typescript
closePane(paneId: number): void {
    for (const tab of this.tabs) {
        const idx = tab.panes.findIndex(p => p.id === paneId);
        if (idx === -1) continue;

        if (tab.panes.length <= 1) {
            this.closeTab(tab.id);
            return;
        }

        const engine = this.getEngineForPane(tab, paneId);
        if (engine) engine.destroy();

        tab.panes.splice(idx, 1);
        this.normalizePaneWidths(tab.panes);

        if (this.activePaneId === paneId) {
            this.activePaneId = tab.panes[Math.min(idx, tab.panes.length - 1)].id;
        }
        this.onPaneClosed.emit({ paneId });
        return;
    }
}
```

Update internal callers that previously used `closePane(tabId, paneId)` to use the new single-arg signature:
- In `cli-panel.component.html`: change `closePane(tab.id, pane.id)` to `closePane(pane.id)`
- In `contextMenuClose()` or other internal methods that called `closePane(tabId, paneId)`: update to `closePane(paneId)`

- [ ] **Step 9: Add `getEngine()` method**

```typescript
getEngine(paneId?: number): CliEngine | undefined {
    const targetPaneId = paneId ?? this.activePaneId;
    // Find the pane across all tabs to determine its flat index in cliComponents
    let flatIndex = 0;
    for (const tab of this.tabs) {
        for (const pane of tab.panes) {
            if (pane.id === targetPaneId) {
                const components = this.cliComponents?.toArray();
                return components?.[flatIndex]?.getEngine();
            }
            flatIndex++;
        }
    }
    return undefined;
}
```

- [ ] **Step 10: Add `getState()` method**

```typescript
getState(): CliPanelState {
    return {
        collapsed: this.resolvedCollapsed,
        hidden: this.resolvedHidden,
        maximized: this.resolvedMaximized,
        position: this.resolvedPosition,
        height: this.resolvedHeight,
        width: this.resolvedWidth,
        activeTabId: this.resolvedActiveTabId,
        activePaneId: this.activePaneId,
        tabs: this.tabs.map(t => ({
            id: t.id,
            title: t.title,
            panes: t.panes.map(p => ({
                id: p.id,
                widthPercent: p.widthPercent,
            })),
        })),
    };
}
```

- [ ] **Step 11: Update `closeTab()` to emit structural event**

In the existing `closeTab(id)` method (line 174), add at the end (after tab removal logic):

```typescript
this.onTabClosed.emit({ tabId: id });
```

- [ ] **Step 12: Update `selectTab()` to emit activeTabId change**

In the existing `selectTab(id)` method (line 192), add after setting `activeTabId`:

```typescript
this.activeTabIdChange.emit(id);
```

- [ ] **Step 13: Update template to pass resolved state to `CollapsableContentComponent`**

In `cli-panel.component.html`, update the `<collapsable-content>` bindings to use the resolved values:

```html
<collapsable-content
    [isCollapsed]="resolvedCollapsed"
    [isMaximized]="resolvedMaximized"
    [isHidden]="resolvedHidden"
    [position]="resolvedPosition"
    ...existing bindings...>
```

The `resolved*` getters are declared as `protected` (Step 2), which Angular 16 Ivy allows in templates.

Also rewire the `(onToggle)` handler in the template. When the user clicks the collapse button in `CollapsableContentComponent`, it emits `onToggle`. The handler must now call the hybrid state setter:

```typescript
onToggle($event: boolean): void {
    this._internalCollapsed = $event;
    this.collapsedChange.emit($event);
    if (!$event && !this.initialized) {
        this.initialized = true;
        this.addTab();
        this.setupThemeSync();
    }
}
```

Similarly, rewire the `(onPositionChange)`, `(onHide)`, and maximize handlers from `CollapsableContentComponent` to update internal state and emit change events.

- [ ] **Step 14: Build angular-cli and verify**

```bash
npx nx build angular-cli
```

Expected: Build succeeds with no errors.

- [ ] **Step 15: Commit**

```bash
git add packages/angular-cli/
git commit -m "feat(angular-cli): implement ICliPanelRef for programmatic panel control"
```

---

## Task 3: React Panel — Implement `ICliPanelRef`

**Files:**
- Modify: `packages/react-cli/src/CliPanel.tsx` (full file)

### Step-by-step

- [ ] **Step 1: Add controlled props and callback props to `CliPanelProps`**

Update the `CliPanelProps` interface (line 10):

```typescript
interface CliPanelProps {
    // Existing
    options?: CliPanelOptions;
    modules?: ICliModule[];
    processors?: ICliCommandProcessor[];
    services?: Record<string, any>;
    onClose?: () => void;
    style?: React.CSSProperties;
    className?: string;

    // Bindable properties (controlled mode)
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
    hidden?: boolean;
    onHiddenChange?: (hidden: boolean) => void;
    maximized?: boolean;
    onMaximizedChange?: (maximized: boolean) => void;
    activeTabId?: number;
    onActiveTabIdChange?: (tabId: number) => void;
    position?: CliPanelPosition;
    onPositionChange?: (position: CliPanelPosition) => void;
    height?: number;
    onHeightChange?: (height: number) => void;
    width?: number;
    onWidthChange?: (width: number) => void;

    // Structural events
    onTabAdded?: (event: { tabId: number }) => void;
    onTabClosed?: (event: { tabId: number }) => void;
    onPaneSplit?: (event: { paneId: number; tabId: number }) => void;
    onPaneClosed?: (event: { paneId: number }) => void;
}
```

- [ ] **Step 2: Wrap component with `forwardRef`**

Change the component declaration from:

```typescript
export function CliPanel(props: CliPanelProps) {
```

To:

```typescript
export const CliPanel = React.forwardRef<ICliPanelRef<CliEngine>, CliPanelProps>(
    function CliPanel(props, ref) {
```

Close the `forwardRef` call at the very end of the component (after the final `return`):

```typescript
    ); // end forwardRef
```

- [ ] **Step 3: Add hybrid controlled/uncontrolled resolution**

At the top of the component body, add resolution logic for each bindable property. The pattern: use prop value if provided, otherwise use internal state. Rename existing state variables to `internal*` variants:

```typescript
// Internal state (used in uncontrolled mode)
const [internalCollapsed, setInternalCollapsed] = useState(
    props.options?.isCollapsed ?? true,
);
const [internalHidden, setInternalHidden] = useState(
    props.options?.isHidden ?? false,
);
const [internalMaximized, setInternalMaximized] = useState(false);
const [internalActiveTabId, setInternalActiveTabId] = useState(0);
const [internalHeight, setInternalHeight] = useState(600);
const [internalWidth, setInternalWidth] = useState(400);
const [internalPosition, setInternalPosition] = useState<CliPanelPosition>(
    loadPanelPosition() ?? props.options?.position ?? 'bottom',
);

// Resolved values (controlled prop takes precedence)
const collapsed = props.collapsed !== undefined ? props.collapsed : internalCollapsed;
const hidden = props.hidden !== undefined ? props.hidden : internalHidden;
const maximized = props.maximized !== undefined ? props.maximized : internalMaximized;
const activeTabId = props.activeTabId !== undefined ? props.activeTabId : internalActiveTabId;
const panelHeight = props.height !== undefined ? props.height : internalHeight;
const panelWidth = props.width !== undefined ? props.width : internalWidth;
const position = props.position !== undefined ? props.position : internalPosition;
```

Add setter helpers that update internal state + emit callback:

```typescript
const updateCollapsed = useCallback((value: boolean) => {
    setInternalCollapsed(value);
    props.onCollapsedChange?.(value);
}, [props.onCollapsedChange]);

const updateHidden = useCallback((value: boolean) => {
    setInternalHidden(value);
    props.onHiddenChange?.(value);
}, [props.onHiddenChange]);

const updateMaximized = useCallback((value: boolean) => {
    setInternalMaximized(value);
    props.onMaximizedChange?.(value);
}, [props.onMaximizedChange]);

const updateActiveTabId = useCallback((value: number) => {
    setInternalActiveTabId(value);
    props.onActiveTabIdChange?.(value);
}, [props.onActiveTabIdChange]);

const updateHeight = useCallback((value: number) => {
    setInternalHeight(value);
    props.onHeightChange?.(value);
}, [props.onHeightChange]);

const updateWidth = useCallback((value: number) => {
    setInternalWidth(value);
    props.onWidthChange?.(value);
}, [props.onWidthChange]);

const updatePosition = useCallback((value: CliPanelPosition) => {
    setInternalPosition(value);
    savePanelPosition(value);
    props.onPositionChange?.(value);
}, [props.onPositionChange]);
```

- [ ] **Step 4: Replace all direct state setters with update helpers**

Go through the component and replace every `setCollapsed(...)`, `setHidden(...)`, `setMaximized(...)`, `setActiveTabId(...)`, `setPanelHeight(...)`, `setPanelWidth(...)`, `setPosition(...)` with the corresponding `update*()` helper. This wires up the event emission for all existing user interactions.

Also replace every read of these state variables to use the resolved values instead.

- [ ] **Step 5: Update `addTab()` to return ID and accept title**

```typescript
const addTab = useCallback((title?: string): number => {
    const tabId = nextIdRef.current.tab++;
    const paneId = nextIdRef.current.pane++;
    setTabs(prev => [
        ...prev,
        {
            id: tabId,
            title: title ?? `Terminal ${tabId}`,
            isEditing: false,
            panes: [{ id: paneId, widthPercent: 100 }],
        },
    ]);
    updateActiveTabId(tabId);
    setActivePaneId(paneId);
    props.onTabAdded?.({ tabId });
    return tabId;
}, [updateActiveTabId, props.onTabAdded]);
```

- [ ] **Step 6: Add `renameTab()` method**

```typescript
const renameTab = useCallback((tabId: number, title: string) => {
    setTabs(prev =>
        prev.map(t => (t.id === tabId ? { ...t, title } : t)),
    );
}, []);
```

- [ ] **Step 7: Add `splitPane()` returning pane ID**

Add a ref to track the current `activeTabId` and `activePaneId` to avoid stale closures:

```typescript
const activeTabIdRef = useRef(activeTabId);
activeTabIdRef.current = activeTabId;
const activePaneIdRef = useRef(activePaneId);
activePaneIdRef.current = activePaneId;
```

Then implement `splitPane`:

```typescript
const splitPane = useCallback((tabId?: number): number => {
    const targetTabId = tabId ?? activeTabIdRef.current;
    const paneId = nextIdRef.current.pane++;
    setTabs(prev =>
        prev.map(t => {
            if (t.id !== targetTabId) return t;
            const newPanes = [...t.panes, { id: paneId, widthPercent: 0 }];
            normalizePanes(newPanes);
            return { ...t, panes: newPanes };
        }),
    );
    setActivePaneId(paneId);
    props.onPaneSplit?.({ paneId, tabId: targetTabId });
    return paneId;
}, [normalizePanes, props.onPaneSplit]);
```

- [ ] **Step 8: Update `closePane()` to single-arg signature searching all tabs**

```typescript
const closePane = useCallback((paneId: number) => {
    setTabs(prev => {
        const newTabs = [...prev];
        for (let i = 0; i < newTabs.length; i++) {
            const tab = newTabs[i];
            const idx = tab.panes.findIndex(p => p.id === paneId);
            if (idx === -1) continue;

            if (tab.panes.length <= 1) {
                // Close the tab instead
                // (defer to closeTab logic)
                setTimeout(() => closeTab(tab.id), 0);
                return prev;
            }

            const newPanes = tab.panes.filter(p => p.id !== paneId);
            normalizePanes(newPanes);
            newTabs[i] = { ...tab, panes: newPanes };

            engineMapRef.current.get(paneId)?.destroy();
            engineMapRef.current.delete(paneId);

            if (activePaneIdRef.current === paneId) {
                setActivePaneId(newPanes[Math.min(idx, newPanes.length - 1)].id);
            }
            props.onPaneClosed?.({ paneId });
            return newTabs;
        }
        return prev;
    });
}, [closeTab, normalizePanes, activePaneId, props.onPaneClosed]);
```

- [ ] **Step 9: Add `closeTab` structural event emission**

In the existing `closeTab()` callback, add at the end:

```typescript
props.onTabClosed?.({ tabId: id });
```

- [ ] **Step 10: Add `getEngine()` method**

```typescript
const getEngine = useCallback((paneId?: number): CliEngine | undefined => {
    const targetId = paneId ?? activePaneId;
    return engineMapRef.current.get(targetId);
}, [activePaneId]);
```

- [ ] **Step 11: Add `getState()` method**

```typescript
const getState = useCallback((): CliPanelState => ({
    collapsed,
    hidden,
    maximized,
    position,
    height: panelHeight,
    width: panelWidth,
    activeTabId,
    activePaneId,
    tabs: tabs.map(t => ({
        id: t.id,
        title: t.title,
        panes: t.panes.map(p => ({
            id: p.id,
            widthPercent: p.widthPercent,
        })),
    })),
}), [collapsed, hidden, maximized, position, panelHeight, panelWidth, activeTabId, activePaneId, tabs]);
```

- [ ] **Step 12: Add `useImperativeHandle`**

```typescript
React.useImperativeHandle(ref, () => ({
    open: () => {
        if (collapsed) {
            updateCollapsed(false);
            if (!initialized) {
                setInitialized(true);
                addTab();
            }
        }
    },
    collapse: () => { if (!collapsed) updateCollapsed(true); },
    toggleCollapse: () => {
        if (collapsed) {
            // same as open()
            updateCollapsed(false);
            if (!initialized) {
                setInitialized(true);
                addTab();
            }
        } else {
            updateCollapsed(true);
        }
    },
    hide: () => { if (!hidden) updateHidden(true); },
    unhide: () => { if (hidden) updateHidden(false); },
    toggleHide: () => { updateHidden(!hidden); },
    close: handleClose,
    maximize: () => { if (!maximized) updateMaximized(true); },
    restore: () => { if (maximized) updateMaximized(false); },
    toggleMaximize: () => { updateMaximized(!maximized); },
    resize: (dims) => {
        if (dims.height !== undefined) updateHeight(dims.height);
        if (dims.width !== undefined) updateWidth(dims.width);
    },
    setPosition: updatePosition,
    addTab,
    closeTab,
    selectTab,
    renameTab,
    splitPane,
    closePane,
    getEngine,
    getState,
}), [
    collapsed, hidden, maximized, initialized,
    updateCollapsed, updateHidden, updateMaximized, updateHeight, updateWidth, updatePosition,
    handleClose, addTab, closeTab, selectTab, renameTab, splitPane, closePane, getEngine, getState,
]);
```

- [ ] **Step 13: Build react-cli and verify**

```bash
npx nx build react-cli
```

Expected: Build succeeds.

- [ ] **Step 14: Commit**

```bash
git add packages/react-cli/
git commit -m "feat(react-cli): implement ICliPanelRef with forwardRef for programmatic panel control"
```

---

## Task 4: Vue Panel — Implement `ICliPanelRef`

**Files:**
- Modify: `packages/vue-cli/src/CliPanel.ts` (full file)

### Step-by-step

- [ ] **Step 1: Add new props for controlled bindings**

In the `props` definition (line 150), add:

```typescript
collapsed: { type: Boolean, default: undefined },
hidden: { type: Boolean, default: undefined },
maximized: { type: Boolean, default: undefined },
activeTabId: { type: Number, default: undefined },
position: { type: String as PropType<CliPanelPosition>, default: undefined },
height: { type: Number, default: undefined },
width: { type: Number, default: undefined },
```

- [ ] **Step 2: Add `emits` declaration**

After `props`, add:

```typescript
emits: [
    'update:collapsed',
    'update:hidden',
    'update:maximized',
    'update:activeTabId',
    'update:position',
    'update:height',
    'update:width',
    'close',
    'tab-added',
    'tab-closed',
    'pane-split',
    'pane-closed',
],
```

- [ ] **Step 3: Update `setup()` to receive `emit` from context**

Change setup signature from `setup(props)` to `setup(props, { expose, emit })`.

- [ ] **Step 4: Add hybrid controlled/uncontrolled resolution**

```typescript
// Internal state (uncontrolled mode)
const internalCollapsed = ref(mergedOptions.value?.isCollapsed ?? true);
const internalHidden = ref(props.options?.isHidden ?? false);
const internalMaximized = ref(false);
const internalActiveTabId = ref(0);
const internalHeight = ref(600);
const internalWidth = ref(400);
const internalPosition = ref<CliPanelPosition>(
    loadPanelPosition() ?? mergedOptions.value?.position ?? 'bottom',
);

// Resolved computed values
const resolvedCollapsed = computed(() =>
    props.collapsed !== undefined ? props.collapsed : internalCollapsed.value,
);
const resolvedHidden = computed(() =>
    props.hidden !== undefined ? props.hidden : internalHidden.value,
);
const resolvedMaximized = computed(() =>
    props.maximized !== undefined ? props.maximized : internalMaximized.value,
);
const resolvedActiveTabId = computed(() =>
    props.activeTabId !== undefined ? props.activeTabId : internalActiveTabId.value,
);
const resolvedHeight = computed(() =>
    props.height !== undefined ? props.height : internalHeight.value,
);
const resolvedWidth = computed(() =>
    props.width !== undefined ? props.width : internalWidth.value,
);
const resolvedPosition = computed(() =>
    props.position !== undefined ? props.position : internalPosition.value,
);
```

Add update helpers:

```typescript
function updateCollapsed(value: boolean) {
    internalCollapsed.value = value;
    emit('update:collapsed', value);
}
function updateHidden(value: boolean) {
    internalHidden.value = value;
    emit('update:hidden', value);
}
function updateMaximized(value: boolean) {
    internalMaximized.value = value;
    emit('update:maximized', value);
}
function updateActiveTabId(value: number) {
    internalActiveTabId.value = value;
    emit('update:activeTabId', value);
}
function updateHeight(value: number) {
    internalHeight.value = value;
    emit('update:height', value);
}
function updateWidth(value: number) {
    internalWidth.value = value;
    emit('update:width', value);
}
function updatePosition(value: CliPanelPosition) {
    internalPosition.value = value;
    savePanelPosition(value);
    emit('update:position', value);
}
```

- [ ] **Step 5: Replace all direct `.value =` writes with update helpers**

Go through all existing functions in setup and replace direct mutations of `collapsed.value`, `hidden.value`, `maximized.value`, etc. with the corresponding `update*()` call. Replace reads of these refs with the resolved computeds.

- [ ] **Step 6: Update `addTab()` to return ID and accept title**

```typescript
function addTab(title?: string): number {
    const tabId = nextTabId++;
    const paneId = nextPaneId++;
    tabs.value = [
        ...tabs.value,
        {
            id: tabId,
            title: title ?? `Terminal ${tabId}`,
            isEditing: false,
            panes: [{ id: paneId, widthPercent: 100 }],
        },
    ];
    updateActiveTabId(tabId);
    activePaneId.value = paneId;
    emit('tab-added', { tabId });
    return tabId;
}
```

- [ ] **Step 7: Add `renameTab()` method**

```typescript
function renameTab(tabId: number, title: string): void {
    tabs.value = tabs.value.map(t =>
        t.id === tabId ? { ...t, title } : t,
    );
}
```

- [ ] **Step 8: Add `splitPane()` returning pane ID**

```typescript
function splitPane(tabId?: number): number {
    const targetTabId = tabId ?? resolvedActiveTabId.value;
    const paneId = nextPaneId++;
    tabs.value = tabs.value.map(t => {
        if (t.id !== targetTabId) return t;
        const newPanes = [...t.panes, { id: paneId, widthPercent: 0 }];
        normalizePanes(newPanes);
        return { ...t, panes: newPanes };
    });
    activePaneId.value = paneId;
    emit('pane-split', { paneId, tabId: targetTabId });
    return paneId;
}
```

- [ ] **Step 9: Update `closePane()` to single-arg signature**

```typescript
function closePane(paneId: number): void {
    for (const tab of tabs.value) {
        const idx = tab.panes.findIndex(p => p.id === paneId);
        if (idx === -1) continue;

        if (tab.panes.length <= 1) {
            closeTab(tab.id);
            return;
        }

        engineMap.get(paneId)?.destroy();
        engineMap.delete(paneId);

        const newPanes = tab.panes.filter(p => p.id !== paneId);
        normalizePanes(newPanes);
        tab.panes = newPanes;

        if (activePaneId.value === paneId) {
            activePaneId.value = newPanes[Math.min(idx, newPanes.length - 1)].id;
        }
        emit('pane-closed', { paneId });
        // Trigger reactivity
        tabs.value = [...tabs.value];
        return;
    }
}
```

- [ ] **Step 10: Add structural event to `closeTab()` and `activeTabId` emission to `selectTab()`**

In existing `closeTab()`, add after tab removal:

```typescript
emit('tab-closed', { tabId: id });
```

In existing `selectTab()`, replace direct `activeTabId.value = id` with:

```typescript
updateActiveTabId(id);
```

This ensures the `update:activeTabId` event is emitted when a tab is selected.

- [ ] **Step 11: Add `getEngine()` and `getState()` methods**

```typescript
function getEngine(paneId?: number): CliEngine | undefined {
    const targetId = paneId ?? activePaneId.value;
    return engineMap.get(targetId);
}

function getState(): CliPanelState {
    return {
        collapsed: resolvedCollapsed.value,
        hidden: resolvedHidden.value,
        maximized: resolvedMaximized.value,
        position: resolvedPosition.value,
        height: resolvedHeight.value,
        width: resolvedWidth.value,
        activeTabId: resolvedActiveTabId.value,
        activePaneId: activePaneId.value,
        tabs: tabs.value.map(t => ({
            id: t.id,
            title: t.title,
            panes: t.panes.map(p => ({
                id: p.id,
                widthPercent: p.widthPercent,
            })),
        })),
    };
}
```

- [ ] **Step 12: Add `expose()` call**

At the end of the `setup()` function, before the `return` (render function):

```typescript
expose({
    open: () => {
        if (resolvedCollapsed.value) {
            updateCollapsed(false);
            if (!initialized.value) {
                initialized.value = true;
                addTab();
                setupThemeSync();
            }
        }
    },
    collapse: () => { if (!resolvedCollapsed.value) updateCollapsed(true); },
    toggleCollapse: () => {
        if (resolvedCollapsed.value) {
            updateCollapsed(false);
            if (!initialized.value) {
                initialized.value = true;
                addTab();
                setupThemeSync();
            }
        } else {
            updateCollapsed(true);
        }
    },
    hide: () => { if (!resolvedHidden.value) updateHidden(true); },
    unhide: () => { if (resolvedHidden.value) updateHidden(false); },
    toggleHide: () => { updateHidden(!resolvedHidden.value); },
    close: handleClose,
    maximize: () => { if (!resolvedMaximized.value) updateMaximized(true); },
    restore: () => { if (resolvedMaximized.value) updateMaximized(false); },
    toggleMaximize: () => { updateMaximized(!resolvedMaximized.value); },
    resize: (dims: { height?: number; width?: number }) => {
        if (dims.height !== undefined) updateHeight(dims.height);
        if (dims.width !== undefined) updateWidth(dims.width);
    },
    setPosition: updatePosition,
    addTab,
    closeTab,
    selectTab,
    renameTab,
    splitPane,
    closePane,
    getEngine,
    getState,
});
```

- [ ] **Step 13: Update render function to use resolved values**

In the render function (`return () => { ... }`), replace references to the old state variables (`collapsed.value`, `hidden.value`, etc.) with the resolved computeds (`resolvedCollapsed.value`, `resolvedHidden.value`, etc.).

- [ ] **Step 14: Build vue-cli and verify**

```bash
npx nx build vue-cli
```

Expected: Build succeeds.

- [ ] **Step 15: Commit**

```bash
git add packages/vue-cli/
git commit -m "feat(vue-cli): implement ICliPanelRef with expose() for programmatic panel control"
```

---

## Task 5: Full Build Verification

- [ ] **Step 1: Build all packages**

```bash
pnpm run build
```

Expected: All 31 projects build successfully. No type errors.

- [ ] **Step 2: Run tests**

```bash
pnpm test
```

Expected: All existing tests pass. Kill any lingering processes after:

```bash
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

- [ ] **Step 3: Verify demo apps compile**

```bash
npx nx build demo-angular && npx nx build demo-react && npx nx build demo-vue
```

Expected: All three demo apps build without errors.

- [ ] **Step 4: Commit any remaining fixes**

If any build/test issues were found and fixed, commit them:

```bash
git add -A
git commit -m "fix: resolve build issues from panel API implementation"
```

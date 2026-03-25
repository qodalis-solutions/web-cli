# CLI Panel Programmatic Control API — Design Spec

**Date:** 2026-03-25
**Status:** Approved

## Problem

The `CliPanel` component across all three frameworks (Angular, React, Vue) has no programmatic control API. All state — collapse, maximize, hide, tabs, panes, resize, position — is internal-only, controlled exclusively through user interaction or initial config props. External code cannot open, close, minimize, resize, add tabs, or query the panel's state.

## Goal

Expose a unified imperative + reactive API for `CliPanel` in all three frameworks, enabling external code to:

- Control panel chrome state (open, collapse, hide, maximize, resize, position)
- Manage tabs (add, close, select, rename)
- Manage panes (split, close)
- Access engine instances for direct terminal interaction
- Query current panel state
- Optionally drive state via reactive bindings (controlled component pattern)

## Design

### 1. Shared Interface (`@qodalis/cli-core`)

A framework-agnostic interface that all panel implementations conform to.

```typescript
// packages/core/src/lib/interfaces/cli-panel-ref.ts

export interface ICliPanelRef {
    // ── Panel chrome ──

    /** Expand the panel (sets collapsed=false). Initializes the first tab on first call. */
    open(): void;
    /** Collapse the panel body (sets collapsed=true). Does NOT hide or close. */
    collapse(): void;
    toggleCollapse(): void;
    /** Hide the panel to a small viewport-edge tab (reversible via unhide). */
    hide(): void;
    unhide(): void;
    toggleHide(): void;
    /** Destroy the panel (sets visible=false, removes from DOM). Irreversible. */
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
     * Existing panes' widths are redistributed evenly.
     */
    splitPane(tabId?: number): number;
    /**
     * Close a pane by ID. The implementation searches all tabs for the pane.
     * Remaining panes' widths are redistributed. No-op if the ID does not exist.
     */
    closePane(paneId: number): void;

    // ── Engine access ──

    /** Get the CliEngine for a specific pane, or the active pane if omitted. */
    getEngine(paneId?: number): CliEngine | undefined;

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

`ICliPanelRef` lives in `@qodalis/cli-core` so consumers and wrapper libraries can type against it without importing a framework-specific package. `CliEngine` is imported from `@qodalis/cli` as a type-only import.

### 2. Reactive Bindings

Six properties support **hybrid controlled/uncontrolled mode**:

| Property | Type | Default |
|---|---|---|
| `collapsed` | `boolean` | `true` |
| `hidden` | `boolean` | `false` |
| `maximized` | `boolean` | `false` |
| `activeTabId` | `number` | first tab's ID |
| `position` | `CliPanelPosition` | `'bottom'` |
| `height` / `width` | `number` | `600` / `400` |

**Hybrid behavior:**

- If the parent does **not** provide a binding, the panel manages state internally (current behavior, fully backwards-compatible).
- If the parent **does** provide a binding, the panel uses that value as its source of truth.
- User interactions **always** emit change events, regardless of controlled/uncontrolled mode.

The controlled-vs-uncontrolled check is: **was the property explicitly provided by the parent?** This is detected per-framework:

- **Angular:** check if the `@Input()` was bound (track via setter or `ngOnChanges`)
- **React:** check if the prop is not `undefined`
- **Vue:** check if the prop is not `undefined` (using `defineProps` defaults vs explicit pass)

### 3. Events

Each bindable property gets a change event:

| Property | Angular `@Output` | React callback prop | Vue emit |
|---|---|---|---|
| `collapsed` | `collapsedChange` | `onCollapsedChange` | `update:collapsed` |
| `hidden` | `hiddenChange` | `onHiddenChange` | `update:hidden` |
| `maximized` | `maximizedChange` | `onMaximizedChange` | `update:maximized` |
| `activeTabId` | `activeTabIdChange` | `onActiveTabIdChange` | `update:activeTabId` |
| `position` | `positionChange` | `onPositionChange` | `update:position` |
| `height` | `heightChange` | `onHeightChange` | `update:height` |
| `width` | `widthChange` | `onWidthChange` | `update:width` |

Structural events (always emitted, not tied to bindings):

| Event | Angular `@Output` | React callback | Vue emit | Payload |
|---|---|---|---|---|
| Panel closed | `onClose` | `onClose` | `close` | `void` |
| Tab added | `onTabAdded` | `onTabAdded` | `tab-added` | `{ tabId: number }` |
| Tab closed | `onTabClosed` | `onTabClosed` | `tab-closed` | `{ tabId: number }` |
| Pane split | `onPaneSplit` | `onPaneSplit` | `pane-split` | `{ paneId: number; tabId: number }` |
| Pane closed | `onPaneClosed` | `onPaneClosed` | `pane-closed` | `{ paneId: number }` |

All methods that accept an ID (tabId, paneId) are no-ops when the ID does not exist. No errors are thrown. IDs are opaque monotonic integers — consumers should not assume specific values or persistence across sessions.

### 4. Per-Framework Access Pattern

#### Angular — `@ViewChild`

The `CliPanelComponent` implements `ICliPanelRef` directly. All methods are public on the component class.

```typescript
// Consumer
@ViewChild(CliPanelComponent) panel!: CliPanelComponent;

ngAfterViewInit() {
    this.panel.open();
    this.panel.addTab('Logs');
}
```

```html
<!-- Two-way binding (Angular banana-in-a-box) -->
<cli-panel
    [(collapsed)]="isCollapsed"
    [(position)]="panelPosition"
    (onTabAdded)="onTab($event)">
</cli-panel>
```

Angular two-way binding (`[()]`) requires matching `@Input() collapsed` + `@Output() collapsedChange` pairs, which this design provides.

#### React — `forwardRef` + `useImperativeHandle`

`CliPanel` is wrapped with `forwardRef`. The ref exposes `ICliPanelRef`.

```tsx
const panelRef = useRef<ICliPanelRef>(null);

<CliPanel
    ref={panelRef}
    collapsed={isCollapsed}
    onCollapsedChange={setCollapsed}
    onTabAdded={({ tabId }) => console.log('new tab', tabId)}
/>

// Imperative
panelRef.current?.open();
panelRef.current?.addTab('Logs');
```

Controlled mode detection: if `collapsed` prop is `undefined`, the panel self-manages. If `collapsed` is provided (even as `false`), the panel is controlled for that property.

#### Vue — `expose()` + template ref

The Vue `CliPanel` uses `defineComponent()` with a `setup(props, { expose })` function (not `<script setup>`). The `expose()` context function is used to expose the `ICliPanelRef` methods. Vue's `v-model:` syntax provides two-way binding.

```vue
<template>
    <CliPanel
        ref="panel"
        v-model:collapsed="isCollapsed"
        v-model:position="panelPosition"
        @tab-added="onTab"
    />
</template>

<script setup>
import { ref } from 'vue';
const panel = ref();

// Imperative
panel.value.open();
panel.value.addTab('Logs');
</script>
```

Vue `v-model:collapsed` desugars to `:collapsed="isCollapsed" @update:collapsed="isCollapsed = $event"`, which aligns with the emit names in the event table.

### 5. Implementation Approach

The panel implementations already have internal methods for most operations. Some methods require signature changes or are new:

- **Existing (expose as-is):** `closeTab()`, `selectTab()`, `toggleTerminal()` (→ `toggleCollapse`), `splitRight()` (→ `splitPane`)
- **Signature change needed:** `addTab()` — currently returns `void`, must return `number` (the new tab ID). `splitRight()` — currently returns `void`, must return `number` (the new pane ID).
- **New methods:** `renameTab()` (programmatic rename, existing `commitRename` is UI-driven), `closePane(paneId)` — existing takes `(tabId, paneId)`, the new API takes just `paneId` and searches all tabs.
- **Delegation needed:** `open()` must include first-tab initialization logic (currently embedded in the expand handler).

The work per package:

1. **Core**: Define `ICliPanelRef`, `CliPanelState`, related interfaces and export them.
2. **Angular**: Implement `ICliPanelRef` on `CliPanelComponent`, add `@Input`/`@Output` pairs for the 6 bindable properties, add hybrid controlled/uncontrolled logic. The `CollapsableContentComponent` needs to expose its state-changing methods upward so `CliPanelComponent` can delegate (collapse, maximize, resize, hide).
3. **React**: Wrap `CliPanel` with `forwardRef`, add `useImperativeHandle` exposing `ICliPanelRef`, add controlled/uncontrolled logic for the 6 properties, add callback props for change events and structural events.
4. **Vue**: Use `expose()` from setup context to expose `ICliPanelRef` methods, add `v-model`-compatible emits for the 6 properties, add structural event emits. Note: Vue `CliPanel` uses `defineComponent()` + render functions, not `<script setup>`.

### 6. Hybrid Controlled/Uncontrolled Logic

The pattern for each bindable property:

```
function resolveValue(propValue, internalState):
    if propValue !== undefined:
        return propValue          // controlled
    return internalState          // uncontrolled

function handleUserAction(newValue):
    if not controlled:
        internalState = newValue  // self-manage
    emit changeEvent(newValue)    // always notify
```

When an imperative method is called (e.g., `panel.open()`), it follows the same path: update internal state if uncontrolled, emit event always. This means in controlled mode, calling `panel.open()` emits `collapsedChange(false)` but doesn't change the visual state until the parent updates its binding.

### 7. Backwards Compatibility

All existing usage continues to work unchanged:

- Panels with no bindings and no ref behave exactly as today (uncontrolled, user-driven).
- The existing `onClose` output/prop/event continues to work.
- The existing `options.isCollapsed`, `options.isHidden`, `options.position` initial-config properties continue to set defaults. The new bindings, if provided, take precedence after initialization.
- No breaking changes to `CliPanelConfig` or `CliPanelOptions`.

### 8. Files to Create/Modify

**Create:**
- `packages/core/src/lib/interfaces/cli-panel-ref.ts` — `ICliPanelRef`, `CliPanelState`, `CliPanelTabState`, `CliPanelPaneState`

**Modify:**
- `packages/core/src/index.ts` — export new interfaces
- `packages/angular-cli/src/lib/cli-panel/cli-panel.component.ts` — implement `ICliPanelRef`, add inputs/outputs, hybrid logic
- `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts` — expose state-change methods for delegation
- `packages/react-cli/src/CliPanel.tsx` — add `forwardRef`, `useImperativeHandle`, controlled props, callback props
- `packages/vue-cli/src/CliPanel.ts` — add `defineExpose`, `v-model` emits, structural event emits

### 9. Testing

Each framework should have tests covering:
- Imperative methods change panel state (uncontrolled mode)
- Controlled bindings override internal state
- Change events fire on user interaction
- Change events fire on imperative method calls
- `getState()` returns accurate snapshot
- `getEngine()` returns the correct engine instance
- Backwards compatibility: panel with no bindings/ref works as before

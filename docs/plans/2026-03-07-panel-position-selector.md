# Panel Position Selector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a header button that cycles panel position (bottom/right/top/left) and persists the user's choice in localStorage.

**Architecture:** A shared utility in `@qodalis/cli-core` handles position cycling and localStorage persistence. Each framework component (Angular, React, Vue) adds a position button to the header, initializes position from localStorage (falling back to config), and saves on change. The existing CSS already supports all 4 positions via `data-position` attribute.

**Tech Stack:** TypeScript, Angular 16, React, Vue 3, localStorage

---

### Task 1: Core — Add panel position store utility

**Files:**
- Create: `packages/core/src/lib/utils/panel-position-store.ts`
- Modify: `packages/core/src/lib/utils/index.ts` (add re-export)

**Step 1: Create the utility file**

```typescript
// packages/core/src/lib/utils/panel-position-store.ts
import { CliPanelPosition } from '../models';

const STORAGE_KEY = 'cli-panel-position';
const POSITION_CYCLE: CliPanelPosition[] = ['bottom', 'right', 'top', 'left'];

/**
 * Load the user's saved panel position from localStorage.
 * Returns null if no preference is saved or localStorage is unavailable.
 */
export function loadPanelPosition(): CliPanelPosition | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && POSITION_CYCLE.includes(stored as CliPanelPosition)) {
            return stored as CliPanelPosition;
        }
    } catch {
        // localStorage unavailable (SSR, security restrictions)
    }
    return null;
}

/**
 * Save the user's panel position preference to localStorage.
 */
export function savePanelPosition(position: CliPanelPosition): void {
    try {
        localStorage.setItem(STORAGE_KEY, position);
    } catch {
        // localStorage unavailable
    }
}

/**
 * Get the next position in the cycle: bottom -> right -> top -> left -> bottom
 */
export function nextPanelPosition(current: CliPanelPosition): CliPanelPosition {
    const index = POSITION_CYCLE.indexOf(current);
    return POSITION_CYCLE[(index + 1) % POSITION_CYCLE.length];
}
```

**Step 2: Add re-export to utils/index.ts**

Add to `packages/core/src/lib/utils/index.ts`:
```typescript
export * from './panel-position-store';
```

**Step 3: Verify build**

Run: `npx nx build core`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add packages/core/src/lib/utils/panel-position-store.ts packages/core/src/lib/utils/index.ts
git commit -m "feat(core): add panel position store utility for localStorage persistence"
```

---

### Task 2: Angular — Add position button to CollapsableContentComponent

**Files:**
- Modify: `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts`
- Modify: `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.html`

**Step 1: Add onPositionChange output to the component class**

In `collapsable-content.component.ts`, add a new `@Output()`:

```typescript
@Output()
public onPositionChange = new EventEmitter<CliPanelPosition>();
```

Add a method to cycle position:

```typescript
cyclePosition(): void {
    this.onPositionChange.emit(this.position);
}
```

**Step 2: Add the position button to the header template**

In `collapsable-content.component.html`, insert a new button in the `.action-buttons` div, **before** the hide button. The icon shows a rectangle with a filled bar indicating current position.

```html
<!-- Position button -->
<button
  class="panel-btn panel-btn-position"
  [title]="'Move panel (' + position + ')'"
  (click)="cyclePosition()"
>
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <!-- bottom -->
    <rect *ngIf="position === 'bottom'" x="4" y="15" width="16" height="5" rx="1" fill="currentColor" stroke="none" opacity="0.5" />
    <!-- top -->
    <rect *ngIf="position === 'top'" x="4" y="4" width="16" height="5" rx="1" fill="currentColor" stroke="none" opacity="0.5" />
    <!-- left -->
    <rect *ngIf="position === 'left'" x="4" y="4" width="5" height="16" rx="1" fill="currentColor" stroke="none" opacity="0.5" />
    <!-- right -->
    <rect *ngIf="position === 'right'" x="15" y="4" width="5" height="16" rx="1" fill="currentColor" stroke="none" opacity="0.5" />
  </svg>
</button>
```

**Step 3: Commit**

```bash
git add packages/angular-cli/src/lib/collapsable-content/
git commit -m "feat(angular-cli): add position cycle button to collapsable-content header"
```

---

### Task 3: Angular — Add position state management to CliPanelComponent

**Files:**
- Modify: `packages/angular-cli/src/lib/cli-panel/cli-panel.component.ts`
- Modify: `packages/angular-cli/src/lib/cli-panel/cli-panel.component.html`

**Step 1: Add position state to the component class**

In `cli-panel.component.ts`:

1. Import `loadPanelPosition`, `savePanelPosition`, `nextPanelPosition` from `@qodalis/cli-core`.
2. Add a `currentPosition` property initialized from localStorage or config:

```typescript
currentPosition: CliPanelPosition = 'bottom';

// In constructor or ngOnInit:
// Initialize position from localStorage, falling back to config
this.currentPosition = loadPanelPosition() ?? this.options?.position ?? 'bottom';
```

Since `options` is an `@Input()` and might not be set at constructor time, use `ngOnInit` or a getter pattern. Simplest: use `ngOnChanges` or initialize in `onToggle` (first expand). But the position should be visible even when collapsed. So initialize eagerly.

Best approach: use a property with lazy initialization on first access, but since Angular needs it bound in the template from the start, add `ngOnInit`:

```typescript
import { OnInit } from '@angular/core';
import { CliPanelPosition, loadPanelPosition, savePanelPosition, nextPanelPosition } from '@qodalis/cli-core';

// Add OnInit to implements
export class CliPanelComponent implements OnDestroy, OnInit {
    currentPosition: CliPanelPosition = 'bottom';

    ngOnInit(): void {
        this.currentPosition = loadPanelPosition() ?? this.options?.position ?? 'bottom';
    }

    onPositionChange(): void {
        this.currentPosition = nextPanelPosition(this.currentPosition);
        savePanelPosition(this.currentPosition);
    }
}
```

**Step 2: Update the template to use currentPosition and wire the event**

In `cli-panel.component.html`, change the `<collapsable-content>` bindings:

```html
<collapsable-content
  [isCollapsed]="options?.isCollapsed ?? true"
  [position]="currentPosition"
  [closable]="options?.closable ?? true"
  [resizable]="options?.resizable ?? true"
  [hideable]="options?.hideable ?? true"
  [hideAlignment]="options?.hideAlignment ?? 'center'"
  [themeStyles]="themeStyles"
  (onToggle)="onToggle($event)"
  (onContentSizeChange)="onContentSizeChange($event)"
  (onClose)="onClose.emit()"
  (onPositionChange)="onPositionChange()"
  *ngIf="visible"
>
```

**Step 3: Build Angular CLI**

Run: `npx nx build angular-cli`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add packages/angular-cli/src/lib/cli-panel/ packages/angular-cli/src/lib/collapsable-content/
git commit -m "feat(angular-cli): wire panel position cycling with localStorage persistence"
```

---

### Task 4: React — Add position cycling and persistence

**Files:**
- Modify: `packages/react-cli/src/CliPanel.tsx`

**Step 1: Import utilities and add position state**

Add imports:
```typescript
import { ..., loadPanelPosition, savePanelPosition, nextPanelPosition } from '@qodalis/cli-core';
```

Replace the static `position` const with stateful position:
```typescript
const [position, setPosition] = useState<CliPanelPosition>(
    () => loadPanelPosition() ?? options?.position ?? 'bottom'
);
```

Derive `isHorizontal` from the stateful position (it already does: `const isHorizontal = position === 'left' || position === 'right';` — this now reads from state).

Remove the old `const position = options?.position ?? 'bottom';` line.

**Step 2: Add the position cycle handler**

```typescript
const handlePositionChange = useCallback(() => {
    setPosition(prev => {
        const next = nextPanelPosition(prev);
        savePanelPosition(next);
        return next;
    });
}, []);
```

**Step 3: Add the PositionIcon component**

Before the `CliPanel` function, add:

```typescript
function PositionIcon({ position }: { position: string }) {
    let fillRect: React.ReactElement;
    switch (position) {
        case 'top':
            fillRect = <rect x="4" y="4" width="16" height="5" rx="1" fill="currentColor" stroke="none" opacity="0.5" />;
            break;
        case 'left':
            fillRect = <rect x="4" y="4" width="5" height="16" rx="1" fill="currentColor" stroke="none" opacity="0.5" />;
            break;
        case 'right':
            fillRect = <rect x="15" y="4" width="5" height="16" rx="1" fill="currentColor" stroke="none" opacity="0.5" />;
            break;
        default: // bottom
            fillRect = <rect x="4" y="15" width="16" height="5" rx="1" fill="currentColor" stroke="none" opacity="0.5" />;
            break;
    }
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            {fillRect}
        </svg>
    );
}
```

**Step 4: Add the button to the JSX**

In the `cli-panel-action-buttons` div, insert before the hide button:

```tsx
<button className="cli-panel-btn cli-panel-btn-position" title={`Move panel (${position})`} onClick={handlePositionChange}>
    <PositionIcon position={position} />
</button>
```

**Step 5: Build React CLI**

Run: `npx nx build react-cli`
Expected: BUILD SUCCESS

**Step 6: Commit**

```bash
git add packages/react-cli/src/CliPanel.tsx
git commit -m "feat(react-cli): add panel position cycling with localStorage persistence"
```

---

### Task 5: Vue — Add position cycling and persistence

**Files:**
- Modify: `packages/vue-cli/src/CliPanel.ts`

**Step 1: Import utilities and add position state**

Add to imports from `@qodalis/cli-core`:
```typescript
import { ..., loadPanelPosition, savePanelPosition, nextPanelPosition } from '@qodalis/cli-core';
```

Replace the computed position with a ref initialized from localStorage:
```typescript
const position = ref<CliPanelPosition>(loadPanelPosition() ?? mergedOptions.value?.position ?? 'bottom');
```

Keep `isHorizontal` as computed but derived from the ref:
```typescript
const isHorizontal = computed(() => position.value === 'left' || position.value === 'right');
```

**Step 2: Add cycle handler**

```typescript
const handlePositionChange = () => {
    position.value = nextPanelPosition(position.value);
    savePanelPosition(position.value);
};
```

**Step 3: Add position icon helper function**

```typescript
function positionIcon(pos: string) {
    let fillRect: any;
    switch (pos) {
        case 'top':
            fillRect = h('rect', { x: '4', y: '4', width: '16', height: '5', rx: '1', fill: 'currentColor', stroke: 'none', opacity: '0.5' });
            break;
        case 'left':
            fillRect = h('rect', { x: '4', y: '4', width: '5', height: '16', rx: '1', fill: 'currentColor', stroke: 'none', opacity: '0.5' });
            break;
        case 'right':
            fillRect = h('rect', { x: '15', y: '4', width: '5', height: '16', rx: '1', fill: 'currentColor', stroke: 'none', opacity: '0.5' });
            break;
        default: // bottom
            fillRect = h('rect', { x: '4', y: '15', width: '16', height: '5', rx: '1', fill: 'currentColor', stroke: 'none', opacity: '0.5' });
            break;
    }
    return h('svg', { ...svgAttrs }, [
        h('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2' }),
        fillRect,
    ]);
}
```

**Step 4: Add the button to the render function**

In the action-buttons section of the render function, insert before the hide button:

```typescript
h('button', {
    class: 'cli-panel-btn cli-panel-btn-position',
    title: `Move panel (${position.value})`,
    onClick: handlePositionChange,
}, [positionIcon(position.value)]),
```

**Step 5: Build Vue CLI**

Run: `npx nx build vue-cli`
Expected: BUILD SUCCESS

**Step 6: Commit**

```bash
git add packages/vue-cli/src/CliPanel.ts
git commit -m "feat(vue-cli): add panel position cycling with localStorage persistence"
```

---

### Task 6: Full build verification

**Step 1: Build all projects**

Run: `pnpm run build`
Expected: All 31 projects build successfully

**Step 2: Verify no lint errors**

Run: `npx nx lint core && npx nx lint angular-cli && npx nx lint react-cli && npx nx lint vue-cli`
Expected: No errors

**Step 3: Final commit (if any fixes needed)**

---

## Summary of Changes

| File | Change |
|---|---|
| `packages/core/src/lib/utils/panel-position-store.ts` | NEW: `loadPanelPosition()`, `savePanelPosition()`, `nextPanelPosition()` |
| `packages/core/src/lib/utils/index.ts` | Re-export new utility |
| `packages/angular-cli/.../collapsable-content.component.ts` | Add `onPositionChange` output, `cyclePosition()` method |
| `packages/angular-cli/.../collapsable-content.component.html` | Add position button with position-indicator SVG icon |
| `packages/angular-cli/.../cli-panel.component.ts` | Add `currentPosition` state, `ngOnInit`, `onPositionChange()` handler |
| `packages/angular-cli/.../cli-panel.component.html` | Bind `[position]="currentPosition"`, wire `(onPositionChange)` |
| `packages/react-cli/src/CliPanel.tsx` | Add `position` state, `PositionIcon`, cycle handler, button |
| `packages/vue-cli/src/CliPanel.ts` | Add `position` ref, `positionIcon()`, cycle handler, button |

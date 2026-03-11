# CLI Panel Hide Mode — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "hidden" state to the CLI panel that collapses it to a small animated arrow tab at the viewport edge, with separate Hide and Close buttons.

**Architecture:** New `hidden` boolean state in all three framework wrappers. When hidden, the panel wrapper gets `display: none` and a new `.cli-panel-hide-tab` element renders at the same viewport edge. The tab is a fixed-position 40x40px button with a chevron + terminal icon. Clicking it restores the panel to its pre-hide state (expanded or collapsed). Config types live in `@qodalis/cli-core`, shared CSS in `cli-panel.css`, Angular uses its `CollapsableContentComponent`, React/Vue handle it inline.

**Tech Stack:** TypeScript, CSS, Angular 16, React, Vue 3

---

### Task 1: Add types to `@qodalis/cli-core`

**Files:**
- Modify: `packages/core/src/lib/models/index.ts:443-472`

**Step 1: Add the new type and fields**

In `packages/core/src/lib/models/index.ts`, after the `CliPanelPosition` type (line 443), add the alignment type. Then add two new fields to `CliPanelConfig`:

```typescript
export type CliPanelPosition = 'bottom' | 'top' | 'left' | 'right';

/**
 * Alignment of the hidden-mode tab along its viewport edge.
 */
export type CliPanelHideAlignment = 'start' | 'center' | 'end';

export interface CliPanelConfig {
    /**
     * Whether the CLI should be collapsed by default.
     * @default true
     */
    isCollapsed?: boolean;

    /**
     * Position of the panel relative to the viewport.
     * @default 'bottom'
     */
    position?: CliPanelPosition;

    /**
     * Whether the close button is shown.
     * @default true
     */
    closable?: boolean;

    /**
     * Whether the panel can be resized by dragging.
     * @default true
     */
    resizable?: boolean;

    /**
     * Whether the hide button is shown. When hidden, the panel collapses
     * to a small tab at the viewport edge.
     * @default true
     */
    hideable?: boolean;

    /**
     * Alignment of the hide tab along the panel's viewport edge.
     * For bottom/top: 'start' = left, 'center', 'end' = right.
     * For left/right: 'start' = top, 'center', 'end' = bottom.
     * @default 'center'
     */
    hideAlignment?: CliPanelHideAlignment;
}
```

**Step 2: Build core to verify**

Run: `npx nx build core`
Expected: BUILD SUCCESS

**Step 3: Commit**

```bash
git add packages/core/src/lib/models/index.ts
git commit -m "feat(core): add hideable and hideAlignment to CliPanelConfig"
```

---

### Task 2: Add shared CSS for the hide tab

**Files:**
- Modify: `packages/cli/src/assets/cli-panel.css:599-615` (append before the global helper section)

**Step 1: Add hide tab styles to cli-panel.css**

Insert the following block before the `/* --- Global helper ---*/` section (before line 609):

```css
/* ─── Hide tab ──────────────────────────────────────────── */

.cli-panel-hide-tab {
  position: fixed;
  z-index: 1000;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--cli-panel-header-bg, #1f2937);
  border: 1px solid var(--cli-panel-border, #374151);
  color: var(--cli-panel-text-secondary, rgba(255, 255, 255, 0.6));
  cursor: pointer;
  padding: 0;
  appearance: none;
  transition: transform 0.2s ease, opacity 0.2s ease, color 0.2s ease, background-color 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  opacity: 0.85;
}

.cli-panel-hide-tab:hover {
  transform: scale(1.1);
  opacity: 1;
  color: var(--cli-panel-text, rgba(255, 255, 255, 0.87));
  background-color: var(--cli-panel-bg, #111827);
}

.cli-panel-hide-tab:active {
  transform: scale(0.95);
}

.cli-panel-hide-tab svg {
  flex-shrink: 0;
}

/* Arrow pulse on hover */
@keyframes cli-hide-tab-pulse {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(3px); }
}

.cli-panel-hide-tab:hover .cli-panel-hide-tab-arrow {
  animation: cli-hide-tab-pulse 0.6s ease infinite;
}

/* ─── Hide tab: bottom position ─────────────────────────── */

.cli-panel-hide-tab[data-position="bottom"] {
  bottom: 0;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
}

.cli-panel-hide-tab[data-position="bottom"][data-hide-align="start"] { left: 16px; }
.cli-panel-hide-tab[data-position="bottom"][data-hide-align="center"] { left: 50%; margin-left: -20px; }
.cli-panel-hide-tab[data-position="bottom"][data-hide-align="end"] { right: 16px; }

/* ─── Hide tab: top position ────────────────────────────── */

.cli-panel-hide-tab[data-position="top"] {
  top: 0;
  border-top: none;
  border-radius: 0 0 8px 8px;
}

.cli-panel-hide-tab[data-position="top"][data-hide-align="start"] { left: 16px; }
.cli-panel-hide-tab[data-position="top"][data-hide-align="center"] { left: 50%; margin-left: -20px; }
.cli-panel-hide-tab[data-position="top"][data-hide-align="end"] { right: 16px; }

/* ─── Hide tab: left position ───────────────────────────── */

.cli-panel-hide-tab[data-position="left"] {
  left: 0;
  border-left: none;
  border-radius: 0 8px 8px 0;
}

.cli-panel-hide-tab[data-position="left"][data-hide-align="start"] { top: 16px; }
.cli-panel-hide-tab[data-position="left"][data-hide-align="center"] { top: 50%; margin-top: -20px; }
.cli-panel-hide-tab[data-position="left"][data-hide-align="end"] { bottom: 16px; }

/* ─── Hide tab: right position ──────────────────────────── */

.cli-panel-hide-tab[data-position="right"] {
  right: 0;
  border-right: none;
  border-radius: 8px 0 0 8px;
}

.cli-panel-hide-tab[data-position="right"][data-hide-align="start"] { top: 16px; }
.cli-panel-hide-tab[data-position="right"][data-hide-align="center"] { top: 50%; margin-top: -20px; }
.cli-panel-hide-tab[data-position="right"][data-hide-align="end"] { bottom: 16px; }

/* ─── Hideable / data-attribute toggle ──────────────────── */

.cli-panel-wrapper[data-hideable="false"] .cli-panel-btn-hide {
  display: none;
}
```

Also update the pulse keyframe to be direction-aware per position. The CSS above uses a horizontal pulse as default. For vertical positions (left/right), the pulse direction changes via the `data-position` attribute:

```css
/* Override pulse direction for vertical positions */
@keyframes cli-hide-tab-pulse-vertical {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(3px); }
}

.cli-panel-hide-tab[data-position="left"]:hover .cli-panel-hide-tab-arrow,
.cli-panel-hide-tab[data-position="right"]:hover .cli-panel-hide-tab-arrow {
  animation: cli-hide-tab-pulse-vertical 0.6s ease infinite;
}
```

**Step 2: Build cli package**

Run: `npx nx build cli`
Expected: BUILD SUCCESS

**Step 3: Commit**

```bash
git add packages/cli/src/assets/cli-panel.css
git commit -m "feat(cli): add hide tab CSS styles and animations"
```

---

### Task 3: Angular — Update CollapsableContentComponent

**Files:**
- Modify: `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts`
- Modify: `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.html`
- Modify: `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.sass`

**Step 1: Update the TypeScript component**

In `collapsable-content.component.ts`, add:

1. Import `CliPanelHideAlignment` from `@qodalis/cli-core`
2. New `@Input()` properties: `hideable: boolean = true`, `hideAlignment: CliPanelHideAlignment = 'center'`
3. New state: `isHidden: boolean = false`, `preHideCollapsed: boolean = true`
4. New `@Output()`: `onHide = new EventEmitter<void>()`
5. Method `hideTerminal()`: stores `preHideCollapsed = this.isCollapsed`, sets `isHidden = true`, emits `onHide`
6. Method `unhideTerminal()`: sets `isHidden = false`, restores `isCollapsed = preHideCollapsed`, emits `onToggle` if expanding

```typescript
import {
    Component,
    EventEmitter,
    Input,
    Output,
    HostListener,
} from '@angular/core';
import { CliPanelPosition, CliPanelHideAlignment } from '@qodalis/cli-core';

const HEADER_HEIGHT = 60;

@Component({
    selector: 'collapsable-content',
    templateUrl: './collapsable-content.component.html',
    styleUrls: ['./collapsable-content.component.sass'],
})
export class CollapsableContentComponent {
    previousPanelHeight = 600;
    panelHeight = 600;
    panelWidth = 400;
    previousPanelWidth = 400;

    isResizing = false;
    startY = 0;
    startX = 0;
    startHeight = 0;
    startWidth = 0;

    @Input() visible: boolean = true;
    @Input() isCollapsed: boolean = true;
    @Input() isMaximized: boolean = false;
    @Input() position: CliPanelPosition = 'bottom';
    @Input() closable: boolean = true;
    @Input() resizable: boolean = true;
    @Input() hideable: boolean = true;
    @Input() hideAlignment: CliPanelHideAlignment = 'center';

    @Output()
    public onToggle = new EventEmitter<boolean>();

    @Output()
    public onContentSizeChange = new EventEmitter<number>();

    @Output()
    public onClose = new EventEmitter<void>();

    @Output()
    public onHide = new EventEmitter<void>();

    isHidden = false;
    private preHideCollapsed = true;

    get isHorizontal(): boolean {
        return this.position === 'left' || this.position === 'right';
    }

    toggleTerminal(): void {
        this.isCollapsed = !this.isCollapsed;
        this.onToggle.emit(this.isCollapsed);
    }

    closeTerminal(): void {
        this.visible = false;
        this.onClose.emit();
    }

    hideTerminal(): void {
        this.preHideCollapsed = this.isCollapsed;
        this.isHidden = true;
        this.onHide.emit();
    }

    unhideTerminal(): void {
        this.isHidden = false;
        this.isCollapsed = this.preHideCollapsed;
        this.onToggle.emit(this.isCollapsed);
    }

    toggleMaximizationTerminal(): void {
        // ... unchanged ...
    }

    onResizeStart(event: MouseEvent) {
        // ... unchanged ...
    }

    @HostListener('document:mousemove', ['$event'])
    onMouseMove(event: MouseEvent) {
        // ... unchanged ...
    }

    @HostListener('document:mouseup')
    onMouseUp() {
        this.isResizing = false;
    }

    private updateTerminalSize() {
        // ... unchanged ...
    }
}
```

**Step 2: Update the HTML template**

Replace `collapsable-content.component.html` with:

```html
<!-- Hide tab (shown when panel is hidden) -->
<button
  *ngIf="visible && isHidden"
  class="cli-panel-hide-tab"
  [attr.data-position]="position"
  [attr.data-hide-align]="hideAlignment"
  title="Show CLI"
  (click)="unhideTerminal()"
>
  <svg
    class="cli-panel-hide-tab-arrow"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <!-- bottom: chevron up -->
    <polyline *ngIf="position === 'bottom'" points="18 15 12 9 6 15" />
    <!-- top: chevron down -->
    <polyline *ngIf="position === 'top'" points="6 9 12 15 18 9" />
    <!-- left: chevron right -->
    <polyline *ngIf="position === 'left'" points="9 18 15 12 9 6" />
    <!-- right: chevron left -->
    <polyline *ngIf="position === 'right'" points="15 6 9 12 15 18" />
  </svg>
</button>

<!-- Main panel (hidden when isHidden) -->
<div
  *ngIf="visible && !isHidden"
  class="terminal-wrapper"
  [class.collapsed]="isCollapsed"
  [class.maximized]="isMaximized"
  [class.resizing]="isResizing"
  [attr.data-position]="position"
  [attr.data-resizable]="resizable"
  [attr.data-closable]="closable"
  [attr.data-hideable]="hideable"
  [style]="isHorizontal
    ? { width: panelWidth + 'px' }
    : { height: panelHeight + 'px' }"
>
  <div class="terminal-header">
    <div class="resize-bar" (mousedown)="onResizeStart($event)">
      <div class="resize-grip"></div>
    </div>
    <div class="header-content">
      <p class="terminal-title">
        <svg
          class="title-icon"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
        CLI
      </p>
      <div class="action-buttons">
        <!-- Hide button -->
        <button
          *ngIf="hideable"
          class="panel-btn panel-btn-hide"
          title="Hide"
          (click)="hideTerminal()"
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
            <line x1="5" y1="18" x2="19" y2="18" />
            <polyline points="9 14 12 17 15 14" />
          </svg>
        </button>

        <button
          class="panel-btn"
          [title]="!isMaximized ? 'Maximize' : 'Restore'"
          [disabled]="isCollapsed"
          (click)="toggleMaximizationTerminal()"
        >
          <svg
            *ngIf="!isMaximized"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
          <svg
            *ngIf="isMaximized"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>

        <button
          class="panel-btn"
          [title]="isCollapsed ? 'Expand' : 'Collapse'"
          (click)="toggleTerminal()"
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
            <polyline *ngIf="position === 'bottom' && isCollapsed" points="18 15 12 9 6 15" />
            <polyline *ngIf="position === 'bottom' && !isCollapsed" points="6 9 12 15 18 9" />
            <polyline *ngIf="position === 'top' && isCollapsed" points="6 9 12 15 18 9" />
            <polyline *ngIf="position === 'top' && !isCollapsed" points="18 15 12 9 6 15" />
            <polyline *ngIf="position === 'left' && isCollapsed" points="9 18 15 12 9 6" />
            <polyline *ngIf="position === 'left' && !isCollapsed" points="15 6 9 12 15 18" />
            <polyline *ngIf="position === 'right' && isCollapsed" points="15 6 9 12 15 18" />
            <polyline *ngIf="position === 'right' && !isCollapsed" points="9 18 15 12 9 6" />
          </svg>
        </button>

        <button class="panel-btn panel-btn-close" title="Close" (click)="closeTerminal()">
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  </div>
  <div class="terminal-content" *ngIf="!isCollapsed">
    <ng-content></ng-content>
  </div>
</div>
```

**Step 3: No SASS changes needed**

The hide tab uses classes from the shared `cli-panel.css`. The Angular SASS only styles the panel wrapper internals which remain unchanged. The `cli-panel-hide-tab` class is global CSS loaded from the cli package assets.

**Step 4: Update CliPanelComponent to pass through new inputs**

In `packages/angular-cli/src/lib/cli-panel/cli-panel.component.html`, add the new bindings to the `<collapsable-content>` tag:

```html
<collapsable-content
  [isCollapsed]="options?.isCollapsed ?? true"
  [position]="options?.position ?? 'bottom'"
  [closable]="options?.closable ?? true"
  [resizable]="options?.resizable ?? true"
  [hideable]="options?.hideable ?? true"
  [hideAlignment]="options?.hideAlignment ?? 'center'"
  (onToggle)="onToggle($event)"
  (onContentSizeChange)="onContentSizeChange($event)"
  (onClose)="onClose.emit()"
  *ngIf="visible"
>
```

**Step 5: Build Angular package**

Run: `npx nx build angular-cli`
Expected: BUILD SUCCESS

**Step 6: Commit**

```bash
git add packages/angular-cli/
git commit -m "feat(angular-cli): add hide mode to CollapsableContentComponent"
```

---

### Task 4: React — Add hide mode to CliPanel

**Files:**
- Modify: `packages/react-cli/src/CliPanel.tsx`

**Step 1: Add hide state and icon**

Add at the top of the component (around line 108-118), after existing config reads:

```typescript
const hideable = options?.hideable ?? true;
const hideAlignment = options?.hideAlignment ?? 'center';
```

Add state (around line 113-118):

```typescript
const [hidden, setHidden] = useState(false);
const preHideCollapsedRef = useRef(true);
```

Add the HideIcon SVG component after CloseIcon (around line 69-74):

```typescript
const HideIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="18" x2="19" y2="18" />
        <polyline points="9 14 12 17 15 14" />
    </svg>
);
```

Add a `HideTabChevron` component that renders the inward-pointing arrow based on position:

```typescript
function HideTabChevron({ position }: { position: string }) {
    let points: string;
    switch (position) {
        case 'top': points = '6 9 12 15 18 9'; break;
        case 'left': points = '9 18 15 12 9 6'; break;
        case 'right': points = '15 6 9 12 15 18'; break;
        default: points = '18 15 12 9 6 15'; break; // bottom: up
    }
    return (
        <svg className="cli-panel-hide-tab-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points={points} />
        </svg>
    );
}
```

**Step 2: Add hide/unhide handlers**

After the `handleClose` callback (around line 425-428):

```typescript
const handleHide = useCallback(() => {
    preHideCollapsedRef.current = collapsed;
    setHidden(true);
}, [collapsed]);

const handleUnhide = useCallback(() => {
    setHidden(false);
    setCollapsed(preHideCollapsedRef.current);
}, []);
```

**Step 3: Update the render section**

At the beginning of the render (around line 432), change the early return:

```typescript
if (!visible) return null;

if (hidden) {
    return (
        <button
            className="cli-panel-hide-tab"
            data-position={position}
            data-hide-align={hideAlignment}
            title="Show CLI"
            onClick={handleUnhide}
        >
            <HideTabChevron position={position} />
        </button>
    );
}
```

**Step 4: Add the Hide button to the action buttons**

In the action buttons div (around line 457-468), add the Hide button before Maximize:

```tsx
<div className="cli-panel-action-buttons">
    {hideable && (
        <button className="cli-panel-btn cli-panel-btn-hide" title="Hide" onClick={handleHide}>
            <HideIcon />
        </button>
    )}
    <button className="cli-panel-btn" title={maximized ? 'Restore' : 'Maximize'} disabled={collapsed} onClick={toggleMaximize}>
        {maximized ? <RestoreIcon /> : <MaximizeIcon />}
    </button>
    <button className="cli-panel-btn" title={collapsed ? 'Expand' : 'Collapse'} onClick={toggle}>
        <CollapseChevron position={position} isCollapsed={collapsed} />
    </button>
    {closable && (
        <button className="cli-panel-btn cli-panel-btn-close" title="Close" onClick={handleClose}>
            <CloseIcon />
        </button>
    )}
</div>
```

Also add the `data-hideable` attribute to the wrapper div:

```tsx
data-hideable={String(hideable)}
```

**Step 5: Build React package**

Run: `npx nx build react-cli`
Expected: BUILD SUCCESS

**Step 6: Commit**

```bash
git add packages/react-cli/src/CliPanel.tsx
git commit -m "feat(react-cli): add hide mode to CliPanel"
```

---

### Task 5: Vue — Add hide mode to CliPanel

**Files:**
- Modify: `packages/vue-cli/src/CliPanel.ts`

**Step 1: Add SVG helpers and imports**

Update the import line (line 11) to include `CliPanelHideAlignment`:

```typescript
import { ICliCommandProcessor, ICliModule, CliPanelConfig, CliPanelPosition, CliPanelHideAlignment, CliEngineSnapshot } from '@qodalis/cli-core';
```

Add `hideIcon` helper after `closeIcon` (around line 85):

```typescript
const hideIcon = () =>
    h('svg', svgAttrs, [
        h('line', { x1: '5', y1: '18', x2: '19', y2: '18' }),
        h('polyline', { points: '9 14 12 17 15 14' }),
    ]);
```

Add `hideTabChevron` helper after `collapseChevron` (around line 104):

```typescript
function hideTabChevron(position: CliPanelPosition) {
    let points: string;
    switch (position) {
        case 'top': points = '6 9 12 15 18 9'; break;
        case 'left': points = '9 18 15 12 9 6'; break;
        case 'right': points = '15 6 9 12 15 18'; break;
        default: points = '18 15 12 9 6 15'; break;
    }
    return h('svg', { class: 'cli-panel-hide-tab-arrow', ...svgAttrs, width: '20', height: '20', 'stroke-width': '2' }, [
        h('polyline', { points }),
    ]);
}
```

**Step 2: Add state in setup**

After `const initialized = ref(false);` (around line 150):

```typescript
const hidden = ref(false);
let preHideCollapsed = true;
```

Add computed for new config:

```typescript
const hideable = computed(() => mergedOptions.value?.hideable ?? true);
const hideAlignment = computed<CliPanelHideAlignment>(() => mergedOptions.value?.hideAlignment ?? 'center');
```

**Step 3: Add hide/unhide functions**

After `handleClose` function (around line 446):

```typescript
function handleHide() {
    preHideCollapsed = collapsed.value;
    hidden.value = true;
}

function handleUnhide() {
    hidden.value = false;
    collapsed.value = preHideCollapsed;
}
```

**Step 4: Update the render function**

In the render return (around line 450-451), after the `!visible.value` check:

```typescript
return () => {
    if (!visible.value) return null;

    if (hidden.value) {
        return h('button', {
            class: 'cli-panel-hide-tab',
            'data-position': position.value,
            'data-hide-align': hideAlignment.value,
            title: 'Show CLI',
            onClick: handleUnhide,
        }, [hideTabChevron(position.value)]);
    }

    // ... rest of existing render ...
```

**Step 5: Add Hide button to header action buttons**

In the action buttons array (around line 483-514), add the hide button before maximize:

```typescript
h('div', { class: 'cli-panel-action-buttons' }, [
    hideable.value
        ? h('button', {
            class: 'cli-panel-btn cli-panel-btn-hide',
            title: 'Hide',
            onClick: handleHide,
        }, [hideIcon()])
        : null,
    h('button', {
        class: 'cli-panel-btn',
        title: maximized.value ? 'Restore' : 'Maximize',
        disabled: collapsed.value,
        onClick: toggleMaximize,
    }, [maximized.value ? restoreIcon() : maximizeIcon()]),
    h('button', {
        class: 'cli-panel-btn',
        title: collapsed.value ? 'Expand' : 'Collapse',
        onClick: toggle,
    }, [collapseChevron(position.value, collapsed.value)]),
    closable.value
        ? h('button', {
            class: 'cli-panel-btn cli-panel-btn-close',
            title: 'Close',
            onClick: handleClose,
        }, [closeIcon()])
        : null,
]),
```

Also add `data-hideable` to the wrapper:

```typescript
'data-hideable': String(hideable.value),
```

**Step 6: Build Vue package**

Run: `npx nx build vue-cli`
Expected: BUILD SUCCESS

**Step 7: Commit**

```bash
git add packages/vue-cli/src/CliPanel.ts
git commit -m "feat(vue-cli): add hide mode to CliPanel"
```

---

### Task 6: Angular SASS — Add hide tab styles (scoped)

**Files:**
- Modify: `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.sass`

The Angular component uses `ViewEncapsulation.Emulated` by default, so the global `.cli-panel-hide-tab` styles from `cli-panel.css` won't apply. Since the hide tab is rendered inside the Angular component template, we need to add the hide tab styles to the component's SASS as well. Add at the end of the file (after line 279):

```sass
// ─── Hide tab ─────────────────────────────────────────
// Note: These duplicate cli-panel.css styles because Angular
// scoped styles require them to be in the component SASS.

:host ::ng-deep .cli-panel-hide-tab,
.cli-panel-hide-tab
  position: fixed
  z-index: 1000
  width: 40px
  height: 40px
  display: flex
  align-items: center
  justify-content: center
  background-color: var(--cli-panel-header-bg, #1f2937)
  border: 1px solid var(--cli-panel-border, #374151)
  color: var(--cli-panel-text-secondary, rgba(255, 255, 255, 0.6))
  cursor: pointer
  padding: 0
  appearance: none
  transition: transform 0.2s ease, opacity 0.2s ease, color 0.2s ease, background-color 0.2s ease
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3)
  opacity: 0.85

  &:hover
    transform: scale(1.1)
    opacity: 1
    color: var(--cli-panel-text, rgba(255, 255, 255, 0.87))
    background-color: var(--cli-panel-bg, #111827)

  &:active
    transform: scale(0.95)

  svg
    flex-shrink: 0

  // Position: bottom
  &[data-position="bottom"]
    bottom: 0
    border-bottom: none
    border-radius: 8px 8px 0 0

    &[data-hide-align="start"]
      left: 16px
    &[data-hide-align="center"]
      left: 50%
      margin-left: -20px
    &[data-hide-align="end"]
      right: 16px

  // Position: top
  &[data-position="top"]
    top: 0
    border-top: none
    border-radius: 0 0 8px 8px

    &[data-hide-align="start"]
      left: 16px
    &[data-hide-align="center"]
      left: 50%
      margin-left: -20px
    &[data-hide-align="end"]
      right: 16px

  // Position: left
  &[data-position="left"]
    left: 0
    border-left: none
    border-radius: 0 8px 8px 0

    &[data-hide-align="start"]
      top: 16px
    &[data-hide-align="center"]
      top: 50%
      margin-top: -20px
    &[data-hide-align="end"]
      bottom: 16px

  // Position: right
  &[data-position="right"]
    right: 0
    border-right: none
    border-radius: 8px 0 0 8px

    &[data-hide-align="start"]
      top: 16px
    &[data-hide-align="center"]
      top: 50%
      margin-top: -20px
    &[data-hide-align="end"]
      bottom: 16px

@keyframes cli-hide-tab-pulse
  0%, 100%
    transform: translateX(0)
  50%
    transform: translateX(3px)

@keyframes cli-hide-tab-pulse-vertical
  0%, 100%
    transform: translateY(0)
  50%
    transform: translateY(3px)

.cli-panel-hide-tab:hover .cli-panel-hide-tab-arrow
  animation: cli-hide-tab-pulse 0.6s ease infinite

.cli-panel-hide-tab[data-position="left"]:hover .cli-panel-hide-tab-arrow,
.cli-panel-hide-tab[data-position="right"]:hover .cli-panel-hide-tab-arrow
  animation: cli-hide-tab-pulse-vertical 0.6s ease infinite
```

Also add the hide button toggle in the existing closable/hideable section at the end:

```sass
.terminal-wrapper[data-hideable="false"]
  .panel-btn-hide
    display: none
```

**Step 1: Build**

Run: `npx nx build angular-cli`
Expected: BUILD SUCCESS

**Step 2: Commit**

```bash
git add packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.sass
git commit -m "feat(angular-cli): add scoped hide tab styles"
```

---

### Task 7: Build all and verify

**Step 1: Full build**

Run: `pnpm run build`
Expected: All 31 projects build successfully

**Step 2: Verify visually with Angular demo**

Run: `pnpm run serve:angular-demo`

Check in browser at `localhost:4303`:
1. Panel shows Hide button (down-arrow with line) to the left of Maximize
2. Clicking Hide shows a small tab at bottom-center
3. Hovering the tab scales it up with arrow pulse animation
4. Clicking the tab restores the panel to its previous state
5. Close (X) still destroys the panel completely
6. Kill the dev server when done

**Step 3: Verify with React demo**

Run: `pnpm run serve:react-demo`

Same checks at `localhost:4301`. Kill when done.

**Step 4: Verify with Vue demo**

Run: `pnpm run serve:vue-demo`

Same checks at `localhost:4302`. Kill when done.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: CLI panel hide mode — all frameworks"
```

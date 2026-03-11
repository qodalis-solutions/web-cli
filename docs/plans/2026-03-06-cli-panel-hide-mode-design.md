# CLI Panel Hide Mode

## Overview

Add a "hidden" state to the CLI panel — a small ~40x40px arrow tab at the viewport edge. A new Hide button minimizes the panel to this tab. The existing Close button destroys/unmounts the panel entirely. Clicking the hidden tab restores the panel with a smooth animation.

## States

| State | Trigger | What's visible |
|-------|---------|----------------|
| **Expanded** | Click chevron from collapsed, or click hidden tab | Full panel with tabs, terminal |
| **Collapsed** | Click chevron from expanded | 60px header strip at edge |
| **Hidden** | Click Hide button (from any state) | ~40x40px arrow tab at edge |
| **Destroyed** | Click Close button, or programmatic `setVisible(false)` | Nothing |

## Header Buttons

Two separate actions in the panel header, left to right: **Hide**, Maximize, **Close**.

| Button | Icon | Action | Config to disable |
|--------|------|--------|-------------------|
| Hide | Minimize/down arrow | Transition to hidden tab | `hideable: false` |
| Close | X | Destroy/unmount panel | `closable: false` |

## Hidden Tab Design

- **Size**: 40x40px rounded rectangle (border-radius on outer corners only)
- **Content**: Animated chevron arrow pointing inward (toward viewport center) with a subtle terminal icon
- **Position**: Same edge as `position` config, aligned via `hideAlignment` option
- **Hover effect**: Tab scales up gently (1.0 -> 1.1), arrow icon subtly pulses inward
- **Click animation**: Tab scales down slightly, then panel slides in from edge (~300ms cubic-bezier)
- **Styling**: Uses existing `--cli-panel-*` CSS custom properties

## Config Changes (CliPanelConfig in core)

```typescript
export type CliPanelHideAlignment = 'start' | 'center' | 'end';

export interface CliPanelConfig {
    // existing
    isCollapsed?: boolean;
    position?: CliPanelPosition;
    closable?: boolean;
    resizable?: boolean;

    // new
    hideable?: boolean;         // default: true — show Hide button
    hideAlignment?: CliPanelHideAlignment; // default: 'center' — tab position along edge
}
```

## Behavior

- **Hide button** transitions to hidden state, remembering previous state (expanded or collapsed)
- **Hidden tab click** restores to the state before hiding
- **Close button** destroys/unmounts the panel (existing behavior)
- **`closable: false`** hides the Close (X) button only
- **`hideable: false`** hides the Hide button, no way to reach hidden state via UI
- **Programmatic**: `setVisible(false)` still fully destroys. Framework-specific API for hide/unhide.

## CSS Animations

```css
/* Hidden tab hover */
.cli-panel-hide-tab { transition: transform 0.2s ease, opacity 0.2s ease; }
.cli-panel-hide-tab:hover { transform: scale(1.1); }
.cli-panel-hide-tab:hover .arrow { animation: pulse-inward 0.6s ease infinite; }

/* Panel slide in/out */
.cli-panel-wrapper { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
```

## Implementation Scope

| Component | Changes |
|-----------|---------|
| `CliPanelConfig` (core/models) | Add `CliPanelHideAlignment` type, `hideable`, `hideAlignment` fields |
| `cli-panel.css` (cli/assets) | Hidden tab styles, animations, position/alignment variants |
| Angular `CollapsableContentComponent` | Hidden state logic, tab template, hide button |
| Angular `CliPanelComponent` | Pass-through hidden state |
| React `CliPanel.tsx` | Hidden state, tab JSX, hide button, animations |
| Vue `CliPanel.ts` | Hidden state, tab render, hide button, animations |

## Position-Specific Tab Placement

The hidden tab appears on the same edge as the panel position:

| Position | Tab location | Alignment axis |
|----------|-------------|----------------|
| bottom | Bottom edge | Horizontal (start=left, center, end=right) |
| top | Top edge | Horizontal |
| left | Left edge | Vertical (start=top, center, end=bottom) |
| right | Right edge | Vertical |

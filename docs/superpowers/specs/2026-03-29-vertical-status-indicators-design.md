# Vertical Panel Status Indicators Design

## Goal

Add compact status indicators to the vertical (left/right) panel positions. Currently, all status indicators (execution state, services, last command, servers, uptime, notification) are hidden when the panel is in left or right position. This design adds a compact icon-only strip that provides full parity with horizontal mode.

## Architecture

A new `status-indicators-compact` container is placed in the vertical header column between the title and the action buttons. Each indicator renders as a dot or small icon — no text labels. Native `title` tooltips show short info on hover. Services and servers dots are clickable and open the same detail dropdowns as horizontal mode.

Both the full status indicators (horizontal) and compact indicators (vertical) are in the DOM. CSS toggles visibility based on `data-position`.

## Layout

The vertical header column layout becomes:

```
┌──────────┐
│  [Title]  │  writing-mode: vertical-rl
│           │
│    ●      │  execution state dot (green/orange)
│    ⚙      │  services icon (clickable → dropdown)
│    ✓      │  last command icon (green ✓ or red ✗)
│    ●      │  server connection dot (clickable → dropdown)
│    ↑      │  uptime icon
│    ●      │  notification dot (level-colored)
│           │
│  [Btns]   │  action buttons (margin-top: auto)
└──────────┘
```

## Indicator Mapping

| Indicator | Compact Rendering | Tooltip Text | Clickable |
|-----------|------------------|-------------|-----------|
| Execution state | 6px dot: green (idle) / orange pulsing (running) | "idle" or "running" | No |
| Background services | Gear icon (⚙) | "2/3 services" | Yes → services dropdown |
| Last command | Check (✓) green or X (✗) red | "✓ commandName" or "✗ commandName" | No |
| Server connection | 6px dot: green (connected) / red (disconnected) | "1/2 servers" | Yes → servers dropdown |
| Uptime | Arrow icon (↑) | Formatted uptime e.g. "12m 34s" | No |
| Notification | 6px dot colored by level | Full notification message | No |

Conditional visibility per indicator follows the same rules as horizontal mode:
- Services: only shown when `serviceCount.total > 0`
- Last command: only shown when a command has been run
- Servers: only shown when `serverState !== 'none'`
- Uptime: only shown when `uptime > 0`
- Notification: only shown when a notification is active

## CSS

### New compact container

```css
/* Hidden by default (horizontal positions use the full status-indicators) */
.cli-panel-status-indicators-compact {
    display: none;
}

/* Show in left/right positions */
.cli-panel-wrapper[data-position="left"] .cli-panel-status-indicators-compact,
.cli-panel-wrapper[data-position="right"] .cli-panel-status-indicators-compact {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 12px 0;
}
```

### Compact item styling

```css
.cli-panel-status-compact-item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    cursor: default;
}

.cli-panel-status-compact-item.status-clickable {
    cursor: pointer;
    border-radius: 4px;
}

.cli-panel-status-compact-item.status-clickable:hover {
    background-color: var(--cli-btn-hover-bg, rgba(129, 140, 248, 0.12));
}
```

### Notification dot in compact mode

```css
.cli-panel-status-compact-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
}

.cli-panel-status-compact-dot.level-info {
    background: var(--cli-panel-accent, #818cf8);
}

.cli-panel-status-compact-dot.level-success {
    background: var(--cli-status-idle, #3fb950);
}

.cli-panel-status-compact-dot.level-warn {
    background: var(--cli-status-running, #f0883e);
}

.cli-panel-status-compact-dot.level-error {
    background: var(--cli-status-error, #f85149);
}
```

These use `background` (not `color`) since the notification dot is a filled circle, unlike the text-based notification in horizontal mode which uses `color`.

The execution state and server connection dots reuse the existing `cli-panel-status-dot` classes (`dot-idle`, `dot-running`, `dot-error`).

### Hide full indicators in vertical mode

The existing full indicators are already hidden because of `*ngIf="showStatusIndicators"` (Angular) and equivalent conditional rendering in React/Vue that checks `position === 'bottom' || position === 'top'`. No CSS change needed.

## Dropdown Positioning

Services and servers dropdowns use `position: fixed` and are portaled outside the panel wrapper. Their position is computed via inline JS styles using `getBoundingClientRect()` in `toggleServicesDropdown()` / `toggleServersDropdown()` methods.

Currently, the position switch handles `bottom` and `top` cases. The `default` falls back to `bottom`-style positioning, which doesn't work for left/right positions (it positions the dropdown above the trigger using `left` coordinate, but in a vertical panel the trigger is in a narrow 60px strip and the dropdown should open to the side).

### Fix: Add `left` and `right` cases to the position switch

In all three frameworks, `toggleServicesDropdown` and `toggleServersDropdown` need `left` and `right` cases:

```typescript
case 'left':
    style = {
        top: rect.top + 'px',
        left: (rect.right + 4) + 'px',
    };
    break;
case 'right':
    style = {
        top: rect.top + 'px',
        right: (window.innerWidth - rect.left + 4) + 'px',
    };
    break;
```

For `left` position: dropdown opens to the right of the trigger (aligns top edges).
For `right` position: dropdown opens to the left of the trigger (aligns top edges).

No CSS changes needed for dropdown positioning — it's all inline JS.

## Framework Changes

### Angular (`collapsable-content.component.html`)

Add the compact indicators block between the title `<p>` element and the `<div class="action-buttons">`:

```html
<!-- Compact status indicators (left/right positions — CSS controls visibility) -->
<div class="status-indicators-compact">
    <!-- Execution state -->
    <span class="compact-item" [title]="statusExecutionState">
        <span class="status-dot" [class.dot-idle]="statusExecutionState === 'idle'" [class.dot-running]="statusExecutionState === 'running'"></span>
    </span>

    <!-- Background services -->
    <span class="compact-item status-clickable" *ngIf="statusServiceCount.total > 0" [title]="statusServiceCount.running + '/' + statusServiceCount.total + ' services'" (click)="toggleServicesDropdown($event)">
        <span class="status-icon">&#9881;</span>
    </span>

    <!-- Last command -->
    <span class="compact-item" *ngIf="statusLastCommand" [title]="(statusLastCommand.success ? '✓ ' : '✗ ') + statusLastCommand.name">
        <span class="status-icon" [class.status-success]="statusLastCommand.success" [class.status-error]="!statusLastCommand.success">
            {{ statusLastCommand.success ? '&#10003;' : '&#10005;' }}
        </span>
    </span>

    <!-- Server connection -->
    <span class="compact-item status-clickable" *ngIf="statusServerState !== 'none'" [title]="connectedServerCount + '/' + totalServerCount + ' servers'" (click)="toggleServersDropdown($event)">
        <span class="status-dot" [class.dot-idle]="statusServerState === 'connected'" [class.dot-error]="statusServerState === 'disconnected'"></span>
    </span>

    <!-- Uptime -->
    <span class="compact-item status-muted" *ngIf="statusUptime > 0" [title]="formattedUptime">
        <span class="status-icon">&uarr;</span>
    </span>

    <!-- Notification -->
    <span class="compact-item" *ngIf="notification" [title]="notification.message">
        <span class="compact-dot" [ngClass]="'level-' + notification.level"></span>
    </span>
</div>
```

### React (`CliPanel.tsx`)

Add the same compact indicators block between the title and action buttons. Always rendered (CSS toggles visibility).

```tsx
{/* Compact status indicators (left/right positions — CSS controls visibility) */}
<div className="cli-panel-status-indicators-compact">
    {/* Execution state */}
    <span className="cli-panel-status-compact-item" title={statusExecutionState}>
        <span className={`cli-panel-status-dot ${statusExecutionState === 'running' ? 'dot-running' : 'dot-idle'}`} />
    </span>

    {/* Background services */}
    {statusServiceCount.total > 0 && (
        <span className="cli-panel-status-compact-item status-clickable" title={`${statusServiceCount.running}/${statusServiceCount.total} services`} onClick={e => { e.stopPropagation(); setServicesDropdownOpen(prev => !prev); setServersDropdownOpen(false); }}>
            <span className="cli-panel-status-icon">&#9881;</span>
        </span>
    )}

    {/* Last command */}
    {statusLastCommand && (
        <span className="cli-panel-status-compact-item" title={`${statusLastCommand.success ? '✓' : '✗'} ${statusLastCommand.name}`}>
            <span className={`cli-panel-status-icon ${statusLastCommand.success ? 'status-success' : 'status-error'}`}>
                {statusLastCommand.success ? '\u2713' : '\u2717'}
            </span>
        </span>
    )}

    {/* Server connection */}
    {statusServerState !== 'none' && (
        <span className="cli-panel-status-compact-item status-clickable" title={`${statusServerDetails.filter(s => s.connected).length}/${statusServerDetails.length} servers`} onClick={e => { e.stopPropagation(); setServersDropdownOpen(prev => !prev); setServicesDropdownOpen(false); }}>
            <span className={`cli-panel-status-dot ${statusServerState === 'connected' ? 'dot-idle' : 'dot-error'}`} />
        </span>
    )}

    {/* Uptime */}
    {statusUptime > 0 && (
        <span className="cli-panel-status-compact-item status-muted" title={formattedUptime}>
            <span className="cli-panel-status-icon">&uarr;</span>
        </span>
    )}

    {/* Notification */}
    {notification && (
        <span className="cli-panel-status-compact-item" title={notification.message}>
            <span className={`cli-panel-status-compact-dot level-${notification.level}`} />
        </span>
    )}
</div>
```

### Vue (`CliPanel.ts`)

Same pattern as React, using `h()` render function. Always rendered, CSS toggles visibility.

## Framework-Specific Dropdown Changes

### Angular (`collapsable-content.component.ts`)

Add `left` and `right` cases to the switch statement in both `toggleServicesDropdown()` and `toggleServersDropdown()`:

```typescript
case 'left':
    this.servicesDropdownStyle = {  // or serversDropdownStyle
        top: rect.top + 'px',
        left: (rect.right + 4) + 'px',
    };
    break;
case 'right':
    this.servicesDropdownStyle = {  // or serversDropdownStyle
        top: rect.top + 'px',
        right: (window.innerWidth - rect.left + 4) + 'px',
    };
    break;
```

### React (`CliPanel.tsx`)

The React dropdown positioning uses a similar `getBoundingClientRect()` pattern. Add `left` and `right` position handling in the services/servers dropdown click handlers or positioning logic.

### Vue (`CliPanel.ts`)

Same pattern as React — add `left` and `right` cases to the dropdown positioning logic using `getBoundingClientRect()`.

## Backward Compatibility

No breaking changes. Horizontal mode is unaffected. The compact indicators are purely additive — a new DOM block with CSS-controlled visibility.

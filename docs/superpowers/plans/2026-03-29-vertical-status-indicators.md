# Vertical Panel Status Indicators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add compact icon-only status indicators to the vertical (left/right) panel positions, providing full parity with horizontal mode.

**Architecture:** A new `cli-panel-status-indicators-compact` container is placed between the title and action buttons in all three framework panel components. CSS toggles visibility — hidden in horizontal positions, shown in vertical. Clickable items (services, servers) reuse existing dropdown components with new position cases for left/right.

**Tech Stack:** CSS, Angular 16 templates, React JSX, Vue 3 h() render functions

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/cli/src/assets/cli-panel.css` | Add compact container, compact item, and compact dot CSS classes |
| Modify | `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.html:83-123` | Add compact indicators block between title and action buttons |
| Modify | `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts:99-146` | Add `left`/`right` cases to dropdown positioning switches |
| Modify | `packages/react-cli/src/CliPanel.tsx:830-888` | Add compact indicators block between title and action buttons |
| Modify | `packages/react-cli/src/CliPanel.tsx:1079-1118` | Add `left`/`right` cases to dropdown positioning logic |
| Modify | `packages/vue-cli/src/CliPanel.ts:832-893` | Add compact indicators block between title and action buttons |
| Modify | `packages/vue-cli/src/CliPanel.ts:1373-1410` | Add `left`/`right` cases to dropdown positioning logic |

---

### Task 1: Add Compact Status Indicator CSS

**Files:**
- Modify: `packages/cli/src/assets/cli-panel.css:909` (after the `.status-clickable:hover` rule)

- [ ] **Step 1: Add compact indicator CSS rules**

In `packages/cli/src/assets/cli-panel.css`, add after the `.cli-panel-status-item.status-clickable:hover` rule (line 909), before the `/* ─── Tab dot */` comment (line 911):

```css
/* ─── Compact status indicators (vertical positions) ───── */

.cli-panel-status-indicators-compact {
  display: none;
}

.cli-panel-wrapper[data-position="left"] .cli-panel-status-indicators-compact,
.cli-panel-wrapper[data-position="right"] .cli-panel-status-indicators-compact {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
}

.cli-panel-status-compact-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  cursor: default;
  color: var(--cli-panel-text-secondary, rgba(255, 255, 255, 0.6));
  font-size: 12px;
}

.cli-panel-status-compact-item.status-clickable {
  cursor: pointer;
  border-radius: 4px;
}

.cli-panel-status-compact-item.status-clickable:hover {
  background-color: var(--cli-btn-hover-bg, rgba(129, 140, 248, 0.12));
}

.cli-panel-status-compact-item.status-muted {
  color: var(--cli-panel-text-secondary, rgba(255, 255, 255, 0.4));
}

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

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/assets/cli-panel.css
git commit -m "style: add compact status indicator CSS for vertical panel positions"
```

---

### Task 2: Add Compact Indicators to Angular Panel

**Files:**
- Modify: `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.html:122-124`
- Modify: `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts:99-117,121-146`

- [ ] **Step 1: Add compact indicators block to the template**

In `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.html`, insert the following block between the closing `</div>` of the full status indicators (line 122) and the opening `<div class="action-buttons">` (line 124):

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

- [ ] **Step 2: Add `left` and `right` cases to `toggleServicesDropdown`**

In `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts`, replace the `default` case in `toggleServicesDropdown` (lines 112-116) with `left`, `right`, and `default` cases:

```typescript
                case 'left':
                    this.servicesDropdownStyle = {
                        top: rect.top + 'px',
                        left: (rect.right + 4) + 'px',
                    };
                    break;
                case 'right':
                    this.servicesDropdownStyle = {
                        top: rect.top + 'px',
                        right: (window.innerWidth - rect.left + 4) + 'px',
                    };
                    break;
                default:
                    this.servicesDropdownStyle = {
                        bottom: (window.innerHeight - rect.top + 4) + 'px',
                        left: rect.left + 'px',
                    };
```

- [ ] **Step 3: Add `left` and `right` cases to `toggleServersDropdown`**

In `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts`, replace the `default` case in `toggleServersDropdown` (lines 140-144) with `left`, `right`, and `default` cases:

```typescript
                case 'left':
                    this.serversDropdownStyle = {
                        top: rect.top + 'px',
                        left: (rect.right + 4) + 'px',
                    };
                    break;
                case 'right':
                    this.serversDropdownStyle = {
                        top: rect.top + 'px',
                        right: (window.innerWidth - rect.left + 4) + 'px',
                    };
                    break;
                default:
                    this.serversDropdownStyle = {
                        bottom: (window.innerHeight - rect.top + 4) + 'px',
                        left: rect.left + 'px',
                    };
```

- [ ] **Step 4: Build angular-cli to verify**

Run: `npx nx build angular-cli`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.html packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts
git commit -m "feat(angular-cli): add compact status indicators for vertical panel positions"
```

---

### Task 3: Add Compact Indicators to React Panel

**Files:**
- Modify: `packages/react-cli/src/CliPanel.tsx:888,1079-1086,1112-1118`

- [ ] **Step 1: Add compact indicators block**

In `packages/react-cli/src/CliPanel.tsx`, insert the following block after the closing `)}` of the full status indicators conditional (line 888) and before `<div className="cli-panel-action-buttons">` (line 889):

```tsx
                            {/* Compact status indicators (left/right positions — CSS controls visibility) */}
                            <div className="cli-panel-status-indicators-compact">
                                {/* Execution state */}
                                <span className="cli-panel-status-compact-item" title={statusExecutionState}>
                                    <span className={`cli-panel-status-dot ${statusExecutionState === 'running' ? 'dot-running' : 'dot-idle'}`} />
                                </span>

                                {/* Background services */}
                                {statusServiceCount.total > 0 && (
                                    <span
                                        className="cli-panel-status-compact-item status-clickable"
                                        title={`${statusServiceCount.running}/${statusServiceCount.total} services`}
                                        onClick={e => { e.stopPropagation(); setServicesDropdownOpen(prev => !prev); setServersDropdownOpen(false); }}
                                    >
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
                                    <span
                                        className="cli-panel-status-compact-item status-clickable"
                                        title={`${statusServerDetails.filter(s => s.connected).length}/${statusServerDetails.length} servers`}
                                        onClick={e => { e.stopPropagation(); setServersDropdownOpen(prev => !prev); setServicesDropdownOpen(false); }}
                                    >
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

- [ ] **Step 2: Fix services dropdown positioning for left/right**

In `packages/react-cli/src/CliPanel.tsx`, find the services dropdown positioning logic (lines 1079-1086). Replace the ternary:

```typescript
                        style={(() => {
                            const el = servicesDropdownRef.current;
                            if (!el) return {};
                            const rect = el.getBoundingClientRect();
                            return position === 'top'
                                ? { position: 'fixed' as const, top: rect.bottom + 4, left: rect.left, zIndex: 1100 }
                                : { position: 'fixed' as const, bottom: window.innerHeight - rect.top + 4, left: rect.left, zIndex: 1100 };
                        })()}
```

With a function that handles all four positions:

```typescript
                        style={(() => {
                            const el = servicesDropdownRef.current;
                            if (!el) return {};
                            const rect = el.getBoundingClientRect();
                            const base = { position: 'fixed' as const, zIndex: 1100 };
                            switch (position) {
                                case 'top':
                                    return { ...base, top: rect.bottom + 4, left: rect.left };
                                case 'left':
                                    return { ...base, top: rect.top, left: rect.right + 4 };
                                case 'right':
                                    return { ...base, top: rect.top, right: window.innerWidth - rect.left + 4 };
                                default:
                                    return { ...base, bottom: window.innerHeight - rect.top + 4, left: rect.left };
                            }
                        })()}
```

- [ ] **Step 3: Fix servers dropdown positioning for left/right**

In `packages/react-cli/src/CliPanel.tsx`, find the servers dropdown positioning logic (lines 1112-1118). Replace the same ternary pattern with the same switch:

```typescript
                        style={(() => {
                            const el = serversDropdownRef.current;
                            if (!el) return {};
                            const rect = el.getBoundingClientRect();
                            const base = { position: 'fixed' as const, zIndex: 1100 };
                            switch (position) {
                                case 'top':
                                    return { ...base, top: rect.bottom + 4, left: rect.left };
                                case 'left':
                                    return { ...base, top: rect.top, left: rect.right + 4 };
                                case 'right':
                                    return { ...base, top: rect.top, right: window.innerWidth - rect.left + 4 };
                                default:
                                    return { ...base, bottom: window.innerHeight - rect.top + 4, left: rect.left };
                            }
                        })()}
```

- [ ] **Step 4: Build react-cli to verify**

Run: `npx nx build react-cli`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/react-cli/src/CliPanel.tsx
git commit -m "feat(react-cli): add compact status indicators for vertical panel positions"
```

---

### Task 4: Add Compact Indicators to Vue Panel

**Files:**
- Modify: `packages/vue-cli/src/CliPanel.ts:893,1373-1378,1405-1410`

- [ ] **Step 1: Add compact indicators block**

In `packages/vue-cli/src/CliPanel.ts`, insert the following block after the closing `: null,` of the full status indicators conditional (line 893) and before `h('div', { class: 'cli-panel-action-buttons' },` (line 894):

```typescript
                    // Compact status indicators (left/right positions — CSS controls visibility)
                    h('div', { class: 'cli-panel-status-indicators-compact' }, [
                        // Execution state
                        h('span', { class: 'cli-panel-status-compact-item', title: statusExecutionState.value }, [
                            h('span', { class: ['cli-panel-status-dot', statusExecutionState.value === 'running' ? 'dot-running' : 'dot-idle'].join(' ') }),
                        ]),
                        // Background services
                        statusServiceCount.value.total > 0
                            ? h('span', {
                                class: 'cli-panel-status-compact-item status-clickable',
                                title: `${statusServiceCount.value.running}/${statusServiceCount.value.total} services`,
                                onClick: (e: MouseEvent) => {
                                    e.stopPropagation();
                                    servicesDropdownTriggerRect.value = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    servicesDropdownOpen.value = !servicesDropdownOpen.value;
                                    serversDropdownOpen.value = false;
                                },
                            }, [
                                h('span', { class: 'cli-panel-status-icon', innerHTML: '&#9881;' }),
                            ])
                            : null,
                        // Last command
                        statusLastCommand.value
                            ? h('span', {
                                class: 'cli-panel-status-compact-item',
                                title: `${statusLastCommand.value.success ? '✓' : '✗'} ${statusLastCommand.value.name}`,
                            }, [
                                h('span', {
                                    class: ['cli-panel-status-icon', statusLastCommand.value.success ? 'status-success' : 'status-error'].join(' '),
                                    innerHTML: statusLastCommand.value.success ? '&#10003;' : '&#10005;',
                                }),
                            ])
                            : null,
                        // Server connection
                        statusServerState.value !== 'none'
                            ? h('span', {
                                class: 'cli-panel-status-compact-item status-clickable',
                                title: `${statusServerDetails.value.filter(s => s.connected).length}/${statusServerDetails.value.length} servers`,
                                onClick: (e: MouseEvent) => {
                                    e.stopPropagation();
                                    serversDropdownTriggerRect.value = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    serversDropdownOpen.value = !serversDropdownOpen.value;
                                    servicesDropdownOpen.value = false;
                                },
                            }, [
                                h('span', { class: ['cli-panel-status-dot', statusServerState.value === 'connected' ? 'dot-idle' : 'dot-error'].join(' ') }),
                            ])
                            : null,
                        // Uptime
                        statusUptime.value > 0
                            ? h('span', { class: 'cli-panel-status-compact-item status-muted', title: formattedUptime.value }, [
                                h('span', { class: 'cli-panel-status-icon', innerHTML: '&uarr;' }),
                            ])
                            : null,
                        // Notification
                        notification.value
                            ? h('span', { class: 'cli-panel-status-compact-item', title: notification.value.message }, [
                                h('span', { class: `cli-panel-status-compact-dot level-${notification.value.level}` }),
                            ])
                            : null,
                    ].filter(Boolean)),
```

- [ ] **Step 2: Fix services dropdown positioning for left/right**

In `packages/vue-cli/src/CliPanel.ts`, find the services dropdown positioning ternary (lines 1373-1378):

```typescript
                        return resolvedPosition.value === 'top'
                            ? { position: 'fixed', top: `${rect.bottom + 4}px`, left: `${rect.left}px`, zIndex: 1100 }
                            : { position: 'fixed', bottom: `${window.innerHeight - rect.top + 4}px`, left: `${rect.left}px`, zIndex: 1100 };
```

Replace with a switch:

```typescript
                        const base = { position: 'fixed', zIndex: 1100 };
                        switch (resolvedPosition.value) {
                            case 'top':
                                return { ...base, top: `${rect.bottom + 4}px`, left: `${rect.left}px` };
                            case 'left':
                                return { ...base, top: `${rect.top}px`, left: `${rect.right + 4}px` };
                            case 'right':
                                return { ...base, top: `${rect.top}px`, right: `${window.innerWidth - rect.left + 4}px` };
                            default:
                                return { ...base, bottom: `${window.innerHeight - rect.top + 4}px`, left: `${rect.left}px` };
                        }
```

- [ ] **Step 3: Fix servers dropdown positioning for left/right**

In `packages/vue-cli/src/CliPanel.ts`, find the servers dropdown positioning ternary (lines 1405-1410):

```typescript
                        return resolvedPosition.value === 'top'
                            ? { position: 'fixed', top: `${rect.bottom + 4}px`, left: `${rect.left}px`, zIndex: 1100 }
                            : { position: 'fixed', bottom: `${window.innerHeight - rect.top + 4}px`, left: `${rect.left}px`, zIndex: 1100 };
```

Replace with the same switch:

```typescript
                        const base = { position: 'fixed', zIndex: 1100 };
                        switch (resolvedPosition.value) {
                            case 'top':
                                return { ...base, top: `${rect.bottom + 4}px`, left: `${rect.left}px` };
                            case 'left':
                                return { ...base, top: `${rect.top}px`, left: `${rect.right + 4}px` };
                            case 'right':
                                return { ...base, top: `${rect.top}px`, right: `${window.innerWidth - rect.left + 4}px` };
                            default:
                                return { ...base, bottom: `${window.innerHeight - rect.top + 4}px`, left: `${rect.left}px` };
                        }
```

- [ ] **Step 4: Build vue-cli to verify**

Run: `npx nx build vue-cli`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/vue-cli/src/CliPanel.ts
git commit -m "feat(vue-cli): add compact status indicators for vertical panel positions"
```

---

### Task 5: Full Build and Verify

**Files:** None (verification only)

- [ ] **Step 1: Build all projects**

Run: `pnpm run build`
Expected: All projects build successfully.

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: All tests pass. Clean up after:
```bash
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

- [ ] **Step 3: Visual verification**

Run `pnpm run serve:angular-demo` and verify:
1. Panel in bottom position — full status indicators visible, compact indicators hidden
2. Switch panel to left position — compact dot strip appears between title and buttons, full indicators hidden
3. Switch to right position — same compact strip visible
4. Run a command (e.g. `ping google.com`) in left/right position — execution state dot pulses orange, notification dot appears
5. If services/servers are configured, click compact gear/dot — dropdown opens to the side
6. Kill the dev server:
```bash
pkill -f "nx.js" 2>/dev/null || true
```
